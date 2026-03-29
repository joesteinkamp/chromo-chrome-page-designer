/**
 * Framework detection and component introspection.
 * Extracts React/Vue/Svelte component info from DOM elements
 * to enrich change exports for AI coding agents.
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

/** Detect which framework (if any) rendered this element */
export function detectFramework(element: Element): "react" | "vue" | "svelte" | null {
  // React: __reactFiber$ or __reactInternalInstance$ on DOM elements
  const keys = Object.keys(element);
  if (keys.some(k => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"))) {
    return "react";
  }
  // Vue 3: __vueParentComponent, Vue 2: __vue__
  if ("__vueParentComponent" in element || "__vue__" in element) {
    return "vue";
  }
  // Svelte: __svelte_meta (dev mode)
  if ("__svelte_meta" in element) {
    return "svelte";
  }
  return null;
}

/** Extract component info from a DOM element */
export function extractComponentInfo(element: Element): ComponentInfo {
  const framework = detectFramework(element);

  if (framework === "react") return extractReactInfo(element);
  if (framework === "vue") return extractVueInfo(element);
  if (framework === "svelte") return extractSvelteInfo(element);

  return { framework: null, componentName: null, componentHierarchy: [], sourceFile: null, sourceLine: null };
}

// ── React ──

function getReactFiber(element: Element): any {
  const key = Object.keys(element).find(
    k => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
  );
  return key ? (element as any)[key] : null;
}

/** Serialize only JSON-safe primitive props */
function serializeProps(props: Record<string, any>): ComponentProp[] {
  const result: ComponentProp[] = [];
  for (const [key, val] of Object.entries(props)) {
    // Skip React internals and non-editable props
    if (key === "children" || key === "key" || key === "ref") continue;
    if (val === null || val === undefined) {
      result.push({ name: key, value: null, type: "null" });
    } else if (typeof val === "string") {
      result.push({ name: key, value: val, type: "string" });
    } else if (typeof val === "number") {
      result.push({ name: key, value: val, type: "number" });
    } else if (typeof val === "boolean") {
      result.push({ name: key, value: val, type: "boolean" });
    }
    // Skip functions, objects, arrays, React elements, symbols
  }
  return result;
}

/** Find the nearest user component fiber above a DOM element's fiber */
function findNearestComponentFiber(element: Element, targetName?: string): any {
  const fiber = getReactFiber(element);
  if (!fiber) return null;
  let current = fiber.return;
  while (current) {
    if (typeof current.type === "function") {
      const name = current.type.displayName || current.type.name || null;
      if (name && !isInternalComponent(name)) {
        if (!targetName || name === targetName) return current;
      }
    }
    current = current.return;
  }
  return null;
}

function extractReactInfo(element: Element): ComponentInfo {
  const fiber = getReactFiber(element);
  if (!fiber) return { framework: "react", componentName: null, componentHierarchy: [], sourceFile: null, sourceLine: null };

  const hierarchy: string[] = [];
  let sourceFile: string | null = null;
  let sourceLine: number | null = null;
  let componentName: string | null = null;
  let props: ComponentProp[] | undefined;

  // Walk up the fiber tree to find component fibers
  let current = fiber.return;
  while (current) {
    if (typeof current.type === "function") {
      const name = current.type.displayName || current.type.name || null;
      if (name && !isInternalComponent(name)) {
        hierarchy.push(name);
        // First component = nearest
        if (!componentName) {
          componentName = name;
          if (current._debugSource) {
            sourceFile = current._debugSource.fileName || null;
            sourceLine = current._debugSource.lineNumber || null;
          }
          // Extract editable props
          if (current.memoizedProps) {
            props = serializeProps(current.memoizedProps);
          }
        }
      }
    }
    current = current.return;
  }

  return { framework: "react", componentName, componentHierarchy: hierarchy, sourceFile, sourceLine, props };
}

/**
 * Apply a prop change to a React component by mutating fiber props
 * and scheduling a re-render via main world script injection.
 */
export function applyReactProp(
  element: Element,
  componentName: string,
  propName: string,
  propValue: string | number | boolean | null,
  propType: "string" | "number" | "boolean" | "null",
): boolean {
  const fiber = findNearestComponentFiber(element, componentName);
  if (!fiber) return false;

  // Coerce the value to the correct type
  let coerced: any = propValue;
  if (propType === "number") coerced = Number(propValue);
  else if (propType === "boolean") coerced = Boolean(propValue);
  else if (propType === "null") coerced = null;

  // Mutate both memoizedProps and pendingProps so React sees the change
  if (fiber.memoizedProps) fiber.memoizedProps[propName] = coerced;
  if (fiber.pendingProps) fiber.pendingProps[propName] = coerced;

  // Schedule a re-render. We need to run in the main world to access
  // React DevTools hook or trigger forceUpdate.
  // Build a self-contained script to execute in the page's JS context.
  const serializedValue = JSON.stringify(coerced);
  const escapedPropName = JSON.stringify(propName);
  const escapedComponentName = JSON.stringify(componentName);

  const code = `
(function() {
  // Find the DOM element and its fiber
  var el = document.querySelector(${JSON.stringify(generateSelectorForElement(element))});
  if (!el) return;
  var fiberKey = Object.keys(el).find(function(k) {
    return k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$');
  });
  if (!fiberKey) return;
  var fiber = el[fiberKey];

  // Walk up to find the target component
  var current = fiber.return;
  while (current) {
    if (typeof current.type === 'function') {
      var name = (current.type.displayName || current.type.name || null);
      if (name === ${escapedComponentName}) break;
    }
    current = current.return;
  }
  if (!current) return;

  // Update props
  if (current.memoizedProps) current.memoizedProps[${escapedPropName}] = ${serializedValue};
  if (current.pendingProps) current.pendingProps[${escapedPropName}] = ${serializedValue};

  // Try React DevTools hook first (most reliable)
  var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook && hook.renderers) {
    try {
      var renderers = hook.renderers;
      var renderer = renderers.get(1) || (renderers.values ? renderers.values().next().value : null);
      if (renderer && renderer.overrideProps) {
        renderer.overrideProps(current, [${escapedPropName}], ${serializedValue});
        return;
      }
    } catch(e) {}
  }

  // Fallback: force update via class component stateNode
  if (current.stateNode && typeof current.stateNode.forceUpdate === 'function') {
    current.stateNode.forceUpdate();
    return;
  }

  // Fallback for function components: find the fiber root and schedule update
  var root = current;
  while (root.return) root = root.return;
  if (root.stateNode && root.stateNode.current) {
    // Trigger a minimal state update on the root to force reconciliation
    var container = root.stateNode.containerInfo;
    if (container && container._reactRootContainer) {
      // Legacy root
      container._reactRootContainer._internalRoot.current.memoizedState;
    }
  }

  // Last resort: dispatch a synthetic event to trigger re-render
  el.dispatchEvent(new CustomEvent('__pd-force-update'));
})();`;

  executeInMainWorld(code);
  return true;
}

/** Inject a script into the page's main world context */
function executeInMainWorld(code: string): void {
  const script = document.createElement("script");
  script.textContent = code;
  document.documentElement.appendChild(script);
  script.remove();
}

/** Generate a simple selector for use in main world script */
function generateSelectorForElement(element: Element): string {
  if (element.id) return `#${CSS.escape(element.id)}`;
  // Use a data attribute approach - temporarily tag the element
  const marker = `__pd-target-${Date.now()}`;
  element.setAttribute("data-pd-marker", marker);
  const selector = `[data-pd-marker="${marker}"]`;
  // Clean up after a tick (the main world script runs synchronously)
  setTimeout(() => element.removeAttribute("data-pd-marker"), 50);
  return selector;
}

/** Filter out React internal/framework components */
function isInternalComponent(name: string): boolean {
  // Common React internals and framework wrappers
  return /^(Fragment|Suspense|StrictMode|Provider|Consumer|ForwardRef|Memo|Lazy|Profiler|ErrorBoundary)$/.test(name);
}

// ── Vue ──

function extractVueInfo(element: Element): ComponentInfo {
  let componentName: string | null = null;
  let sourceFile: string | null = null;
  const hierarchy: string[] = [];

  try {
    // Vue 3
    if ("__vueParentComponent" in element) {
      let instance = (element as any).__vueParentComponent;
      while (instance) {
        const name = instance.type?.name || instance.type?.__name || null;
        if (name) {
          hierarchy.push(name);
          if (!componentName) {
            componentName = name;
            sourceFile = instance.type?.__file || null;
          }
        }
        instance = instance.parent;
      }
    }
    // Vue 2
    else if ("__vue__" in element) {
      let instance = (element as any).__vue__;
      while (instance) {
        const name = instance.$options?.name || instance.$options?._componentTag || null;
        if (name) {
          hierarchy.push(name);
          if (!componentName) {
            componentName = name;
            sourceFile = instance.$options?.__file || null;
          }
        }
        instance = instance.$parent;
      }
    }
  } catch { /* cross-origin or security restriction */ }

  return { framework: "vue", componentName, componentHierarchy: hierarchy, sourceFile, sourceLine: null };
}

// ── Svelte ──

function extractSvelteInfo(element: Element): ComponentInfo {
  let sourceFile: string | null = null;
  let sourceLine: number | null = null;

  try {
    const meta = (element as any).__svelte_meta;
    if (meta?.loc) {
      sourceFile = meta.loc.file || null;
      sourceLine = meta.loc.line || null;
    }
  } catch { /* */ }

  // Svelte doesn't expose component names on DOM elements easily,
  // but we can extract the filename as a component name
  let componentName: string | null = null;
  if (sourceFile) {
    const match = sourceFile.match(/([^/\\]+)\.svelte$/);
    if (match) componentName = match[1];
  }

  return { framework: "svelte", componentName, componentHierarchy: componentName ? [componentName] : [], sourceFile, sourceLine };
}
