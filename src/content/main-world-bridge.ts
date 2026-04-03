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
          if (typeof current.type === "function") {
            var name =
              current.type.displayName || current.type.name || null;
            if (name && !INTERNAL_RE.test(name)) {
              result.componentHierarchy.push(name);
              if (!foundFirst) {
                foundFirst = true;
                result.componentName = name;
                if (current._debugSource) {
                  result.sourceFile =
                    current._debugSource.fileName || null;
                  result.sourceLine =
                    current._debugSource.lineNumber || null;
                }
                if (current.memoizedProps) {
                  var entries = Object.entries(current.memoizedProps);
                  for (var i = 0; i < entries.length; i++) {
                    var pkey = entries[i][0];
                    var pval = entries[i][1];
                    if (
                      pkey === "children" ||
                      pkey === "key" ||
                      pkey === "ref"
                    )
                      continue;
                    if (pval === null || pval === undefined) {
                      result.props.push({
                        name: pkey,
                        value: null,
                        type: "null",
                      });
                    } else if (typeof pval === "string") {
                      result.props.push({
                        name: pkey,
                        value: pval,
                        type: "string",
                      });
                    } else if (typeof pval === "number") {
                      result.props.push({
                        name: pkey,
                        value: pval,
                        type: "number",
                      });
                    } else if (typeof pval === "boolean") {
                      result.props.push({
                        name: pkey,
                        value: pval,
                        type: "boolean",
                      });
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
              // Extract props from Vue 3 instance
              var vueProps = inst.props;
              if (vueProps) {
                var vpEntries = Object.entries(vueProps);
                for (var vi = 0; vi < vpEntries.length; vi++) {
                  var vpKey = vpEntries[vi][0];
                  var vpVal = vpEntries[vi][1];
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
              // Extract props from Vue 2 instance
              var v2Props = v2.$props || v2._props;
              if (v2Props) {
                var v2pEntries = Object.entries(v2Props);
                for (var v2i = 0; v2i < v2pEntries.length; v2i++) {
                  var v2pKey = v2pEntries[v2i][0];
                  var v2pVal = v2pEntries[v2i][1];
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
        // Extract Svelte props from component context
        var svelteCtx = (el as any).__svelte_meta && (el as any).__svelte_meta.ctx;
        if (!svelteCtx) {
          // Svelte 4: component instance accessible via __s (compiled) or $$
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

    var current = fiber ? fiber.return : null;
    while (current) {
      if (typeof current.type === "function") {
        var name =
          current.type.displayName || current.type.name || null;
        if (
          name &&
          !INTERNAL_RE.test(name) &&
          name === componentName
        )
          break;
      }
      current = current.return;
    }
    if (!current) return;

    if (current.memoizedProps)
      current.memoizedProps[propName] = propValue;
    if (current.pendingProps)
      current.pendingProps[propName] = propValue;

    // Try React DevTools hook first
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

    // Fallback: force update via class component
    if (
      current.stateNode &&
      typeof current.stateNode.forceUpdate === "function"
    ) {
      current.stateNode.forceUpdate();
      return;
    }

    // Walk up to find a class component ancestor
    var ancestor = current.return;
    while (ancestor) {
      if (
        ancestor.stateNode &&
        typeof ancestor.stateNode.forceUpdate === "function"
      ) {
        ancestor.stateNode.forceUpdate();
        break;
      }
      ancestor = ancestor.return;
    }
  }

  function applyVuePropInMain(el: Element, propName: string, propValue: any) {
    // Vue 3: update reactive props on the component instance
    var vue3Inst = (el as any).__vueParentComponent;
    if (vue3Inst) {
      try {
        if (vue3Inst.props && propName in vue3Inst.props) {
          vue3Inst.props[propName] = propValue;
        }
        // Also update via setupState if the prop is forwarded there
        if (vue3Inst.setupState && propName in vue3Inst.setupState) {
          vue3Inst.setupState[propName] = propValue;
        }
        // Trigger Vue 3 re-render
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

    // Vue 2: update via $set or direct assignment
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
    // Svelte 4: use component.$set() API
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
