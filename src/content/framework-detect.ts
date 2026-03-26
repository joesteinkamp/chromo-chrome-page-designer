/**
 * Framework detection and component introspection.
 * Extracts React/Vue/Svelte component info from DOM elements
 * to enrich change exports for AI coding agents.
 */

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

function extractReactInfo(element: Element): ComponentInfo {
  const fiber = getReactFiber(element);
  if (!fiber) return { framework: "react", componentName: null, componentHierarchy: [], sourceFile: null, sourceLine: null };

  const hierarchy: string[] = [];
  let sourceFile: string | null = null;
  let sourceLine: number | null = null;
  let componentName: string | null = null;

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
          // React 18 and earlier: _debugSource has file/line info
          if (current._debugSource) {
            sourceFile = current._debugSource.fileName || null;
            sourceLine = current._debugSource.lineNumber || null;
          }
        }
      }
    }
    current = current.return;
  }

  return { framework: "react", componentName, componentHierarchy: hierarchy, sourceFile, sourceLine };
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
