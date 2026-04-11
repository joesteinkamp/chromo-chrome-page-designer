/**
 * Main world bridge for framework detection.
 * This script runs in the page's JS context (world: "MAIN" in manifest)
 * so it can access React fibers, Vue instances, etc.
 *
 * The isolated world content script communicates by:
 *   1. Setting data attributes on the target element
 *   2. Dispatching a custom event on document.documentElement
 *   3. This listener runs synchronously and writes results as data attributes
 *   4. The isolated world reads the result attributes
 */

(function () {
  var INTERNAL_RE =
    /^(Fragment|Suspense|StrictMode|Provider|Consumer|ForwardRef|Memo|Lazy|Profiler|ErrorBoundary)$/;

  /** UI library internals — skip these to find the user's component */
  var LIBRARY_INTERNAL_RE =
    /^(Mui[A-Z]\w*Root|Mui[A-Z]\w*Base|Styled\(?\w*\)?|Styled\w+|Emotion\w+|Base[A-Z]\w+|Chakra\w+Factory|_c\d*|Transition|Slot|Primitive|ThemeProvider|CssBaseline)/;

  /** Extract component name from a fiber, handling memo/forwardRef wrappers */
  function getComponentName(fiber: any): string | null {
    var type = fiber.type;
    if (!type) return null;

    // Direct function component or class component
    if (typeof type === "function") {
      return type.displayName || type.name || null;
    }

    // forwardRef: { $$typeof: Symbol(react.forward_ref), render: fn }
    if (type.$$typeof) {
      // Check displayName on the wrapper first
      if (type.displayName) return type.displayName;

      var sym = String(type.$$typeof);

      // forwardRef
      if (sym.includes("forward_ref") && type.render) {
        return type.render.displayName || type.render.name || null;
      }

      // memo: { $$typeof: Symbol(react.memo), type: fn | object }
      if (sym.includes("memo") && type.type) {
        if (type.type.displayName) return type.type.displayName;
        if (typeof type.type === "function") {
          return type.type.displayName || type.type.name || null;
        }
        // memo(forwardRef(...))
        if (type.type.render) {
          return type.type.render.displayName || type.type.render.name || null;
        }
      }
    }

    return null;
  }

  /** Check if a fiber represents a user component (not a host element, React internal, or library internal) */
  function isUserComponent(fiber: any): boolean {
    var name = getComponentName(fiber);
    return !!name && !INTERNAL_RE.test(name) && !LIBRARY_INTERNAL_RE.test(name);
  }

  /**
   * Props that are standard HTML/DOM attributes or accessibility-only —
   * not useful for visual design. Filter these out of the component props panel.
   */
  var NON_VISUAL_PROPS = new Set([
    // React internals / DOM plumbing
    "children", "key", "ref", "dangerouslySetInnerHTML",
    // HTML attributes forwarded to DOM (not visual)
    "id", "role", "tabIndex", "tabindex", "title", "lang", "dir",
    "htmlFor", "name", "type", "value", "defaultValue", "defaultChecked",
    "checked", "disabled", "readOnly", "required", "autoFocus", "autoComplete",
    "placeholder", "form", "action", "method", "target", "rel", "href",
    "src", "alt", "loading", "decoding", "crossOrigin",
    "download", "media", "scope", "colSpan", "rowSpan", "wrap",
    "autoPlay", "controls", "loop", "muted", "preload",
    "sandbox", "allow", "allowFullScreen", "frameBorder",
    "contentEditable", "spellCheck", "draggable", "hidden",
    "inputMode", "enterKeyHint", "is", "slot", "part",
    "suppressContentEditableWarning", "suppressHydrationWarning",
  ]);

  /** Prop name patterns that are never visually relevant */
  function isNonVisualProp(name: string): boolean {
    if (NON_VISUAL_PROPS.has(name)) return true;
    // aria-*, data-*, on* (event handlers already filtered by type, but just in case)
    if (name.startsWith("aria-") || name.startsWith("data-") || name.startsWith("on")) return true;
    return false;
  }

  /** Extract props from a fiber's memoizedProps, keeping only visually relevant ones */
  function extractProps(fiber: any): Array<{ name: string; value: any; type: string }> {
    var props: Array<{ name: string; value: any; type: string }> = [];
    if (!fiber.memoizedProps) return props;

    var entries = Object.entries(fiber.memoizedProps);
    for (var i = 0; i < entries.length; i++) {
      var pkey = entries[i][0];
      var pval = entries[i][1];
      if (isNonVisualProp(pkey)) continue;
      if (pval === null || pval === undefined) {
        props.push({ name: pkey, value: null, type: "null" });
      } else if (typeof pval === "string") {
        props.push({ name: pkey, value: pval, type: "string" });
      } else if (typeof pval === "number") {
        props.push({ name: pkey, value: pval, type: "number" });
      } else if (typeof pval === "boolean") {
        props.push({ name: pkey, value: pval, type: "boolean" });
      }
    }
    return props;
  }

  /** Try to extract enum values for string props from propTypes or sibling instances */
  function extractEnumValues(fiber: any): Record<string, string[]> {
    var enums: Record<string, string[]> = {};
    var type = fiber.type;
    // Unwrap memo/forwardRef to get the actual component type
    if (type && type.type) type = type.type;
    if (type && type.render) type = type.render;

    // Check propTypes for oneOf validators
    if (type && type.propTypes) {
      var ptEntries = Object.entries(type.propTypes);
      for (var i = 0; i < ptEntries.length; i++) {
        var ptName = ptEntries[i][0] as string;
        var ptValidator = ptEntries[i][1] as any;
        // React PropTypes.oneOf stores values in the validator function
        if (ptValidator && ptValidator._values) {
          enums[ptName] = ptValidator._values.filter(function(v: any) {
            return typeof v === "string" || typeof v === "number";
          }).map(String);
        }
      }
    }

    // Scan sibling instances: find other fibers with the same component type
    // by walking up to the parent and checking children
    try {
      var componentType = fiber.type;
      var parent = fiber.return;
      if (parent) {
        var siblingValues: Record<string, Set<string>> = {};
        // Walk siblings at the same level
        var child = parent.child;
        var visited = 0;
        while (child && visited < 50) {
          if (child.type === componentType && child.memoizedProps) {
            var sEntries = Object.entries(child.memoizedProps);
            for (var si = 0; si < sEntries.length; si++) {
              var sk = sEntries[si][0] as string;
              var sv = sEntries[si][1];
              if (typeof sv === "string" && sk !== "children" && sk !== "key" && sk !== "className") {
                if (!siblingValues[sk]) siblingValues[sk] = new Set();
                siblingValues[sk].add(sv);
              }
            }
          }
          child = child.sibling;
          visited++;
        }
        // Add sibling-observed values to enums (merge with propTypes)
        var svEntries = Object.entries(siblingValues);
        for (var svi = 0; svi < svEntries.length; svi++) {
          var svName = svEntries[svi][0] as string;
          var svSet = svEntries[svi][1] as Set<string>;
          if (svSet.size > 1) { // Only if there are multiple observed values
            var existing = enums[svName] || [];
            svSet.forEach(function(v) {
              if (existing.indexOf(v) === -1) existing.push(v);
            });
            enums[svName] = existing;
          }
        }
      }
    } catch (e) { /* */ }

    return enums;
  }

  // --- Detect & extract component info ---
  document.documentElement.addEventListener("__pd-detect", function () {
    var el = document.querySelector("[data-pd-detect]");
    if (!el) return;

    var result = {
      framework: null as string | null,
      componentName: null as string | null,
      componentHierarchy: [] as string[],
      sourceFile: null as string | null,
      sourceLine: null as number | null,
      props: [] as Array<{
        name: string;
        value: string | number | boolean | null;
        type: string;
      }>,
      enumValues: {} as Record<string, string[]>,
    };

    var keys = Object.keys(el);
    var isReact = keys.some(function (k) {
      return (
        k.startsWith("__reactFiber$") ||
        k.startsWith("__reactInternalInstance$")
      );
    });
    var isVue3 = "__vueParentComponent" in el;
    var isVue2 = "__vue__" in el;
    var isSvelte = "__svelte_meta" in el;

    if (isReact) {
      result.framework = "react";
      var fiberKey = keys.find(function (k) {
        return (
          k.startsWith("__reactFiber$") ||
          k.startsWith("__reactInternalInstance$")
        );
      });
      if (fiberKey) {
        var fiber = (el as any)[fiberKey];
        var current = fiber ? fiber.return : null;
        var foundFirst = false;
        while (current) {
          if (isUserComponent(current)) {
            var name = getComponentName(current)!;
            result.componentHierarchy.push(name);
            if (!foundFirst) {
              foundFirst = true;
              result.componentName = name;
              // Source info
              if (current._debugSource) {
                result.sourceFile = current._debugSource.fileName || null;
                result.sourceLine = current._debugSource.lineNumber || null;
              }
              // Props
              result.props = extractProps(current);
              // Enum values
              result.enumValues = extractEnumValues(current);
            }
          }
          current = current.return;
        }
      }
    } else if (isVue3) {
      result.framework = "vue";
      try {
        var inst = (el as any).__vueParentComponent;
        var foundVue = false;
        while (inst) {
          var vname =
            (inst.type && (inst.type.name || inst.type.__name)) || null;
          if (vname) {
            result.componentHierarchy.push(vname);
            if (!foundVue) {
              foundVue = true;
              result.componentName = vname;
              result.sourceFile =
                (inst.type && inst.type.__file) || null;
              var vueProps = inst.props;
              if (vueProps) {
                var vpEntries = Object.entries(vueProps);
                for (var vi = 0; vi < vpEntries.length; vi++) {
                  var vpKey = vpEntries[vi][0];
                  var vpVal = vpEntries[vi][1];
                  if (isNonVisualProp(vpKey)) continue;
                  if (vpVal === null || vpVal === undefined) {
                    result.props.push({ name: vpKey, value: null, type: "null" });
                  } else if (typeof vpVal === "string") {
                    result.props.push({ name: vpKey, value: vpVal, type: "string" });
                  } else if (typeof vpVal === "number") {
                    result.props.push({ name: vpKey, value: vpVal, type: "number" });
                  } else if (typeof vpVal === "boolean") {
                    result.props.push({ name: vpKey, value: vpVal, type: "boolean" });
                  }
                }
              }
              // Try to extract Vue prop validators for enum values
              if (inst.type && inst.type.props) {
                var vueEnums: Record<string, string[]> = {};
                var vtpEntries = Object.entries(inst.type.props);
                for (var vti = 0; vti < vtpEntries.length; vti++) {
                  var vtpName = vtpEntries[vti][0] as string;
                  var vtpDef = vtpEntries[vti][1] as any;
                  if (vtpDef && vtpDef.validator && vtpDef.validator._values) {
                    vueEnums[vtpName] = vtpDef.validator._values.map(String);
                  }
                }
                result.enumValues = vueEnums;
              }
            }
          }
          inst = inst.parent;
        }
      } catch (e) {
        /* cross-origin */
      }
    } else if (isVue2) {
      result.framework = "vue";
      try {
        var v2 = (el as any).__vue__;
        var foundV2 = false;
        while (v2) {
          var v2name =
            (v2.$options &&
              (v2.$options.name || v2.$options._componentTag)) ||
            null;
          if (v2name) {
            result.componentHierarchy.push(v2name);
            if (!foundV2) {
              foundV2 = true;
              result.componentName = v2name;
              result.sourceFile =
                (v2.$options && v2.$options.__file) || null;
              var v2Props = v2.$props || v2._props;
              if (v2Props) {
                var v2pEntries = Object.entries(v2Props);
                for (var v2i = 0; v2i < v2pEntries.length; v2i++) {
                  var v2pKey = v2pEntries[v2i][0];
                  var v2pVal = v2pEntries[v2i][1];
                  if (isNonVisualProp(v2pKey)) continue;
                  if (v2pVal === null || v2pVal === undefined) {
                    result.props.push({ name: v2pKey, value: null, type: "null" });
                  } else if (typeof v2pVal === "string") {
                    result.props.push({ name: v2pKey, value: v2pVal, type: "string" });
                  } else if (typeof v2pVal === "number") {
                    result.props.push({ name: v2pKey, value: v2pVal, type: "number" });
                  } else if (typeof v2pVal === "boolean") {
                    result.props.push({ name: v2pKey, value: v2pVal, type: "boolean" });
                  }
                }
              }
            }
          }
          v2 = v2.$parent;
        }
      } catch (e) {
        /* cross-origin */
      }
    } else if (isSvelte) {
      result.framework = "svelte";
      try {
        var meta = (el as any).__svelte_meta;
        if (meta && meta.loc) {
          result.sourceFile = meta.loc.file || null;
          result.sourceLine = meta.loc.line || null;
        }
        if (result.sourceFile) {
          var m = result.sourceFile.match(/([^\\/]+)\.svelte$/);
          if (m) {
            result.componentName = m[1];
            result.componentHierarchy = [m[1]];
          }
        }
        var svelteComp = (el as any).__svelte_component || (el as any).__s;
        if (svelteComp && svelteComp.$$) {
          var svelteProps = svelteComp.$$.props;
          var svelteCtxArr = svelteComp.$$.ctx;
          if (svelteProps && svelteCtxArr) {
            var spEntries = Object.entries(svelteProps);
            for (var si = 0; si < spEntries.length; si++) {
              var spName = spEntries[si][0] as string;
              var spIdx = spEntries[si][1] as number;
              var spVal = svelteCtxArr[spIdx];
              if (isNonVisualProp(spName)) continue;
              if (spVal === null || spVal === undefined) {
                result.props.push({ name: spName, value: null, type: "null" });
              } else if (typeof spVal === "string") {
                result.props.push({ name: spName, value: spVal, type: "string" });
              } else if (typeof spVal === "number") {
                result.props.push({ name: spName, value: spVal, type: "number" });
              } else if (typeof spVal === "boolean") {
                result.props.push({ name: spName, value: spVal, type: "boolean" });
              }
            }
          }
        }
      } catch (e) {
        /* */
      }
    }

    el.setAttribute("data-pd-detect-result", JSON.stringify(result));
  });

  // --- Apply prop change ---
  document.documentElement.addEventListener(
    "__pd-apply-prop",
    function () {
      var el = document.querySelector("[data-pd-apply]");
      if (!el) return;

      var framework = el.getAttribute("data-pd-apply-framework") || "react";
      var componentName = el.getAttribute("data-pd-apply-component");
      var propName = el.getAttribute("data-pd-apply-prop");
      var propValueStr = el.getAttribute("data-pd-apply-value");
      if (!componentName || !propName || propValueStr === null) return;

      var propValue: any;
      try {
        propValue = JSON.parse(propValueStr);
      } catch {
        return;
      }

      if (framework === "react") {
        applyReactPropInMain(el, componentName, propName, propValue);
      } else if (framework === "vue") {
        applyVuePropInMain(el, propName, propValue);
      } else if (framework === "svelte") {
        applySveltePropInMain(el, propName, propValue);
      }
    },
  );

  function applyReactPropInMain(el: Element, componentName: string, propName: string, propValue: any) {
    var keys = Object.keys(el);
    var fiberKey = keys.find(function (k) {
      return (
        k.startsWith("__reactFiber$") ||
        k.startsWith("__reactInternalInstance$")
      );
    });
    if (!fiberKey) return;
    var fiber = (el as any)[fiberKey];

    // Find the target component fiber
    var current = fiber ? fiber.return : null;
    while (current) {
      var name = getComponentName(current);
      if (name && !INTERNAL_RE.test(name) && name === componentName) break;
      current = current.return;
    }
    if (!current) return;

    // Update props on the fiber
    if (current.memoizedProps)
      current.memoizedProps[propName] = propValue;
    if (current.pendingProps)
      current.pendingProps[propName] = propValue;

    // Strategy 1: React DevTools hook (most reliable)
    var hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook && hook.renderers) {
      try {
        var renderers = hook.renderers;
        var renderer =
          renderers.get(1) ||
          (renderers.values
            ? renderers.values().next().value
            : null);
        if (renderer && renderer.overrideProps) {
          renderer.overrideProps(current, [propName], propValue);
          return;
        }
      } catch (e) {
        /* */
      }
    }

    // Strategy 2: Class component forceUpdate
    if (
      current.stateNode &&
      typeof current.stateNode.forceUpdate === "function"
    ) {
      current.stateNode.forceUpdate();
      return;
    }

    // Strategy 3: Function component — trigger re-render via state hook dispatch
    try {
      var stateHook = current.memoizedState;
      while (stateHook) {
        if (stateHook.queue && stateHook.queue.dispatch) {
          // Dispatch an identity update to trigger a re-render
          stateHook.queue.dispatch(function (prev: any) { return prev; });
          return;
        }
        stateHook = stateHook.next;
      }
    } catch (e) {
      /* */
    }

    // Strategy 4: Walk up to find any ancestor that can re-render
    var ancestor = current.return;
    while (ancestor) {
      // Class component ancestor
      if (
        ancestor.stateNode &&
        typeof ancestor.stateNode.forceUpdate === "function"
      ) {
        ancestor.stateNode.forceUpdate();
        return;
      }
      // Function component ancestor with state hooks
      try {
        var ancestorHook = ancestor.memoizedState;
        while (ancestorHook) {
          if (ancestorHook.queue && ancestorHook.queue.dispatch) {
            ancestorHook.queue.dispatch(function (prev: any) { return prev; });
            return;
          }
          ancestorHook = ancestorHook.next;
        }
      } catch (e) {
        /* */
      }
      ancestor = ancestor.return;
    }
  }

  function applyVuePropInMain(el: Element, propName: string, propValue: any) {
    var vue3Inst = (el as any).__vueParentComponent;
    if (vue3Inst) {
      try {
        if (vue3Inst.props && propName in vue3Inst.props) {
          vue3Inst.props[propName] = propValue;
        }
        if (vue3Inst.setupState && propName in vue3Inst.setupState) {
          vue3Inst.setupState[propName] = propValue;
        }
        if (vue3Inst.update && typeof vue3Inst.update === "function") {
          vue3Inst.update();
        } else if (vue3Inst.proxy && vue3Inst.proxy.$forceUpdate) {
          vue3Inst.proxy.$forceUpdate();
        }
      } catch (e) {
        /* */
      }
      return;
    }

    var vue2Inst = (el as any).__vue__;
    if (vue2Inst) {
      try {
        if (vue2Inst.$props && propName in vue2Inst.$props) {
          if (vue2Inst.$set) {
            vue2Inst.$set(vue2Inst.$props, propName, propValue);
          } else {
            vue2Inst.$props[propName] = propValue;
          }
        } else if (vue2Inst._props && propName in vue2Inst._props) {
          if (vue2Inst.$set) {
            vue2Inst.$set(vue2Inst._props, propName, propValue);
          } else {
            vue2Inst._props[propName] = propValue;
          }
        }
        vue2Inst.$forceUpdate();
      } catch (e) {
        /* */
      }
    }
  }

  function applySveltePropInMain(el: Element, propName: string, propValue: any) {
    var svelteComp = (el as any).__svelte_component || (el as any).__s;
    if (svelteComp && typeof svelteComp.$set === "function") {
      try {
        var update: Record<string, any> = {};
        update[propName] = propValue;
        svelteComp.$set(update);
      } catch (e) {
        /* */
      }
    }
  }
})();
