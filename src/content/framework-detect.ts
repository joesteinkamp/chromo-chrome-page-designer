/**
 * Framework detection and component introspection.
 *
 * Content scripts run in Chrome's isolated world and cannot access
 * JS properties set by page scripts (React fibers, Vue instances, etc).
 *
 * Detection is performed by a companion script (main-world-bridge.ts)
 * that runs in the page's main world (registered via manifest.json).
 * Communication uses synchronous custom DOM events — dispatchEvent
 * blocks until all listeners complete, so results are available
 * immediately after dispatch.
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
  const info = extractComponentInfo(element);
  return info.framework;
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
    // Tag the element, then dispatch event for main world bridge to find it.
    // dispatchEvent is synchronous — the main world listener runs and sets
    // data-pd-detect-result before we continue.
    element.setAttribute("data-pd-detect", "");
    document.documentElement.dispatchEvent(new CustomEvent("__pd-detect"));

    // Read the result
    const resultJson = element.getAttribute("data-pd-detect-result");
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
    element.removeAttribute("data-pd-detect");
    element.removeAttribute("data-pd-detect-result");
    return empty;
  }
}

/**
 * Apply a prop change to a React component via main world bridge.
 */
export function applyReactProp(
  element: Element,
  componentName: string,
  propName: string,
  propValue: string | number | boolean | null,
  propType: "string" | "number" | "boolean" | "null",
): boolean {
  try {
    let coerced: any = propValue;
    if (propType === "number") coerced = Number(propValue);
    else if (propType === "boolean") coerced = Boolean(propValue);
    else if (propType === "null") coerced = null;

    // Tag the element with all needed info as data attributes
    element.setAttribute("data-pd-apply", "");
    element.setAttribute("data-pd-apply-component", componentName);
    element.setAttribute("data-pd-apply-prop", propName);
    element.setAttribute("data-pd-apply-value", JSON.stringify(coerced));

    document.documentElement.dispatchEvent(new CustomEvent("__pd-apply-prop"));

    // Clean up
    element.removeAttribute("data-pd-apply");
    element.removeAttribute("data-pd-apply-component");
    element.removeAttribute("data-pd-apply-prop");
    element.removeAttribute("data-pd-apply-value");

    return true;
  } catch {
    element.removeAttribute("data-pd-apply");
    element.removeAttribute("data-pd-apply-component");
    element.removeAttribute("data-pd-apply-prop");
    element.removeAttribute("data-pd-apply-value");
    return false;
  }
}
