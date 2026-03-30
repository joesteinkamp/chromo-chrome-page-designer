/**
 * Framework detection and component introspection.
 * Extracts React/Vue/Svelte component info from DOM elements
 * to enrich change exports for AI coding agents.
 *
 * IMPORTANT: Content scripts run in Chrome's isolated world and cannot
 * access JS properties set by page scripts (e.g. React fibers).
 * All detection runs via main world script injection.
 */

export interface ComponentProp {
  name: string;
  value: string | number | boolean | null;
  type: "string" | "number" | "boolean" | "null";
}

export interface ComponentInfo {
  /** Detected framework: "react", "vue", "svelte", or null */
  framework: "react" | "vue" | "svelte" | null;
  /** Nearest component name (e.g. "HeroSection", "Button") */
  componentName: string | null;
  /** Component hierarchy from nearest to root (e.g. ["Button", "Header", "App"]) */
  componentHierarchy: string[];
  /** Source file location if available (dev mode only) */
  sourceFile: string | null;
  /** Source line number if available */
  sourceLine: number | null;
  /** Editable primitive props from the nearest component */
  props?: ComponentProp[];
}

/**
 * The main world detection script. Injected as a <script> tag so it runs
 * in the page's JS context where framework internals are accessible.
 */
const MAIN_WORLD_DETECT_SCRIPT = `
(function() {
  var INTERNAL_RE = /^(Fragment|Suspense|StrictMode|Provider|Consumer|ForwardRef|Memo|Lazy|Profiler|ErrorBoundary)$/;

  var el = document.querySelector('[data-pd-detect]');
  if (!el) return;

  var result = {
    framework: null,
    componentName: null,
    componentHierarchy: [],
    sourceFile: null,
    sourceLine: null,
    props: []
  };

  // --- Detect framework ---
  var keys = Object.keys(el);
  var isReact = keys.some(function(k) {
    return k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$');
  });
  var isVue3 = '__vueParentComponent' in el;
  var isVue2 = '__vue__' in el;
  var isSvelte = '__svelte_meta' in el;

  if (isReact) {
    result.framework = 'react';
    var fiberKey = keys.find(function(k) {
      return k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$');
    });
    if (fiberKey) {
      var fiber = el[fiberKey];
      var current = fiber ? fiber.return : null;
      var foundFirst = false;
      while (current) {
        if (typeof current.type === 'function') {
          var name = current.type.displayName || current.type.name || null;
          if (name && !INTERNAL_RE.test(name)) {
            result.componentHierarchy.push(name);
            if (!foundFirst) {
              foundFirst = true;
              result.componentName = name;
              if (current._debugSource) {
                result.sourceFile = current._debugSource.fileName || null;
                result.sourceLine = current._debugSource.lineNumber || null;
              }
              // Extract primitive props
              if (current.memoizedProps) {
                var entries = Object.entries(current.memoizedProps);
                for (var i = 0; i < entries.length; i++) {
                  var pkey = entries[i][0];
                  var pval = entries[i][1];
                  if (pkey === 'children' || pkey === 'key' || pkey === 'ref') continue;
                  if (pval === null || pval === undefined) {
                    result.props.push({ name: pkey, value: null, type: 'null' });
                  } else if (typeof pval === 'string') {
                    result.props.push({ name: pkey, value: pval, type: 'string' });
                  } else if (typeof pval === 'number') {
                    result.props.push({ name: pkey, value: pval, type: 'number' });
                  } else if (typeof pval === 'boolean') {
                    result.props.push({ name: pkey, value: pval, type: 'boolean' });
                  }
                }
              }
            }
          }
        }
        current = current.return;
      }
    }
  } else if (isVue3) {
    result.framework = 'vue';
    try {
      var inst = el.__vueParentComponent;
      var foundVue = false;
      while (inst) {
        var vname = inst.type && (inst.type.name || inst.type.__name) || null;
        if (vname) {
          result.componentHierarchy.push(vname);
          if (!foundVue) {
            foundVue = true;
            result.componentName = vname;
            result.sourceFile = inst.type && inst.type.__file || null;
          }
        }
        inst = inst.parent;
      }
    } catch(e) {}
  } else if (isVue2) {
    result.framework = 'vue';
    try {
      var v2 = el.__vue__;
      var foundV2 = false;
      while (v2) {
        var v2name = v2.$options && (v2.$options.name || v2.$options._componentTag) || null;
        if (v2name) {
          result.componentHierarchy.push(v2name);
          if (!foundV2) {
            foundV2 = true;
            result.componentName = v2name;
            result.sourceFile = v2.$options && v2.$options.__file || null;
          }
        }
        v2 = v2.$parent;
      }
    } catch(e) {}
  } else if (isSvelte) {
    result.framework = 'svelte';
    try {
      var meta = el.__svelte_meta;
      if (meta && meta.loc) {
        result.sourceFile = meta.loc.file || null;
        result.sourceLine = meta.loc.line || null;
      }
      if (result.sourceFile) {
        var m = result.sourceFile.match(/([^\\\\/]+)\\.svelte$/);
        if (m) {
          result.componentName = m[1];
          result.componentHierarchy = [m[1]];
        }
      }
    } catch(e) {}
  }

  el.setAttribute('data-pd-detect-result', JSON.stringify(result));
})();
`;

/**
 * The main world prop apply script template.
 * Placeholders: __PD_PROP_NAME__, __PD_PROP_VALUE__, __PD_COMPONENT_NAME__
 */
const MAIN_WORLD_APPLY_SCRIPT = `
(function() {
  var el = document.querySelector('[data-pd-apply]');
  if (!el) return;

  var propName = __PD_PROP_NAME__;
  var propValue = __PD_PROP_VALUE__;
  var componentName = __PD_COMPONENT_NAME__;

  // Find fiber
  var keys = Object.keys(el);
  var fiberKey = keys.find(function(k) {
    return k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$');
  });
  if (!fiberKey) return;
  var fiber = el[fiberKey];

  // Walk up to find the target component
  var INTERNAL_RE = /^(Fragment|Suspense|StrictMode|Provider|Consumer|ForwardRef|Memo|Lazy|Profiler|ErrorBoundary)$/;
  var current = fiber ? fiber.return : null;
  while (current) {
    if (typeof current.type === 'function') {
      var name = (current.type.displayName || current.type.name || null);
      if (name && !INTERNAL_RE.test(name) && name === componentName) break;
    }
    current = current.return;
  }
  if (!current) return;

  // Update props
  if (current.memoizedProps) current.memoizedProps[propName] = propValue;
  if (current.pendingProps) current.pendingProps[propName] = propValue;

  // Try React DevTools hook first (most reliable)
  var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook && hook.renderers) {
    try {
      var renderers = hook.renderers;
      var renderer = renderers.get(1) || (renderers.values ? renderers.values().next().value : null);
      if (renderer && renderer.overrideProps) {
        renderer.overrideProps(current, [propName], propValue);
        el.removeAttribute('data-pd-apply');
        return;
      }
    } catch(e) {}
  }

  // Fallback: force update via class component stateNode
  if (current.stateNode && typeof current.stateNode.forceUpdate === 'function') {
    current.stateNode.forceUpdate();
    el.removeAttribute('data-pd-apply');
    return;
  }

  // Fallback for function components: walk up to find a class component ancestor
  var ancestor = current.return;
  while (ancestor) {
    if (ancestor.stateNode && typeof ancestor.stateNode.forceUpdate === 'function') {
      ancestor.stateNode.forceUpdate();
      break;
    }
    ancestor = ancestor.return;
  }

  el.removeAttribute('data-pd-apply');
})();
`;

/** Inject a script into the page's main world context */
function executeInMainWorld(code: string): void {
  const script = document.createElement("script");
  script.textContent = code;
  document.documentElement.appendChild(script);
  script.remove();
}

/** Detect which framework (if any) rendered this element */
export function detectFramework(_element: Element): "react" | "vue" | "svelte" | null {
  // This is now handled by extractComponentInfo via main world bridge.
  // Kept for backward compatibility but always returns null from isolated world.
  return null;
}

/** Extract component info from a DOM element via main world bridge */
export function extractComponentInfo(element: Element): ComponentInfo {
  const empty: ComponentInfo = {
    framework: null,
    componentName: null,
    componentHierarchy: [],
    sourceFile: null,
    sourceLine: null,
  };

  try {
    // Tag the element so the main world script can find it
    element.setAttribute("data-pd-detect", "");

    // Run detection in main world (synchronous — inline script runs immediately)
    executeInMainWorld(MAIN_WORLD_DETECT_SCRIPT);

    // Read the result
    const resultJson = element.getAttribute("data-pd-detect-result");

    // Clean up
    element.removeAttribute("data-pd-detect");
    element.removeAttribute("data-pd-detect-result");

    if (!resultJson) return empty;

    const result = JSON.parse(resultJson);
    return {
      framework: result.framework || null,
      componentName: result.componentName || null,
      componentHierarchy: result.componentHierarchy || [],
      sourceFile: result.sourceFile || null,
      sourceLine: result.sourceLine || null,
      props: result.props && result.props.length > 0 ? result.props : undefined,
    };
  } catch {
    // Clean up on error
    element.removeAttribute("data-pd-detect");
    element.removeAttribute("data-pd-detect-result");
    return empty;
  }
}

/**
 * Apply a prop change to a React component via main world script injection.
 */
export function applyReactProp(
  element: Element,
  componentName: string,
  propName: string,
  propValue: string | number | boolean | null,
  propType: "string" | "number" | "boolean" | "null",
): boolean {
  try {
    // Coerce value
    let coerced: any = propValue;
    if (propType === "number") coerced = Number(propValue);
    else if (propType === "boolean") coerced = Boolean(propValue);
    else if (propType === "null") coerced = null;

    // Tag the element
    element.setAttribute("data-pd-apply", "");

    // Build the script with actual values substituted
    const code = MAIN_WORLD_APPLY_SCRIPT
      .replace("__PD_PROP_NAME__", JSON.stringify(propName))
      .replace("__PD_PROP_VALUE__", JSON.stringify(coerced))
      .replace("__PD_COMPONENT_NAME__", JSON.stringify(componentName));

    executeInMainWorld(code);

    // Clean up (the script also removes data-pd-apply, but just in case)
    element.removeAttribute("data-pd-apply");

    return true;
  } catch {
    element.removeAttribute("data-pd-apply");
    return false;
  }
}
