/** Separator used to encode iframe path in selectors */
export const IFRAME_SELECTOR_SEP = " >>> ";

/**
 * Generate a unique CSS selector for a DOM element.
 * Produces readable selectors suitable for developer handoff.
 * When the element is inside an iframe, the selector is prefixed
 * with the iframe's own selector in the parent document using ">>>".
 */
export function generateSelector(element: Element): string {
  const base = generateLocalSelector(element);

  // If we're in an iframe, prefix with the iframe's path in the parent document
  if (window !== window.top) {
    const iframePath = getIframePath();
    if (iframePath) {
      return iframePath + IFRAME_SELECTOR_SEP + base;
    }
  }

  return base;
}

/**
 * Build the iframe path by walking up the frame hierarchy.
 * Returns a selector that identifies this iframe element in the top document,
 * or a chain of ">>>" if nested.
 */
function getIframePath(): string {
  const parts: string[] = [];
  let currentWindow: Window = window;

  while (currentWindow !== currentWindow.top) {
    try {
      const parentDoc = currentWindow.parent.document;
      const iframes = parentDoc.querySelectorAll("iframe, frame");
      let found = false;
      for (const iframe of iframes) {
        if ((iframe as HTMLIFrameElement).contentWindow === currentWindow) {
          parts.unshift(generateIframeSelector(iframe, parentDoc));
          found = true;
          break;
        }
      }
      if (!found) {
        // Can't identify this iframe — use a generic marker
        parts.unshift("iframe");
      }
    } catch {
      // Cross-origin — can't access parent document
      // Use src-based selector as fallback
      try {
        const src = (currentWindow.frameElement as HTMLIFrameElement)?.src;
        if (src) {
          parts.unshift(`iframe[src="${CSS.escape(src)}"]`);
        } else {
          parts.unshift("iframe");
        }
      } catch {
        parts.unshift("iframe");
      }
    }
    currentWindow = currentWindow.parent;
  }

  return parts.join(IFRAME_SELECTOR_SEP);
}

/** Generate a selector for an iframe element within its parent document */
function generateIframeSelector(iframe: Element, doc: Document): string {
  // Try id first
  if (iframe.id) {
    const byId = doc.querySelectorAll(`#${CSS.escape(iframe.id)}`);
    if (byId.length === 1) return `#${CSS.escape(iframe.id)}`;
  }

  // Try src attribute (common and stable)
  const src = iframe.getAttribute("src");
  if (src) {
    const bySrc = doc.querySelectorAll(`iframe[src="${CSS.escape(src)}"]`);
    if (bySrc.length === 1) return `iframe[src="${CSS.escape(src)}"]`;
  }

  // Try name attribute
  const name = iframe.getAttribute("name");
  if (name) {
    const byName = doc.querySelectorAll(`iframe[name="${CSS.escape(name)}"]`);
    if (byName.length === 1) return `iframe[name="${CSS.escape(name)}"]`;
  }

  // Fallback: nth-of-type
  const parent = iframe.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(s => s.tagName === iframe.tagName);
    if (siblings.length > 1) {
      const index = siblings.indexOf(iframe) + 1;
      return `iframe:nth-of-type(${index})`;
    }
  }

  return "iframe";
}

/**
 * Parse a potentially iframe-aware selector into its iframe path and local selector.
 * Returns { iframePath: string[], localSelector: string }.
 */
export function parseIframeSelector(selector: string): {
  iframePath: string[];
  localSelector: string;
} {
  const parts = selector.split(IFRAME_SELECTOR_SEP);
  const localSelector = parts.pop()!;
  return { iframePath: parts, localSelector };
}

/**
 * Generate a CSS selector within the local document (no iframe prefix).
 */
function generateLocalSelector(element: Element): string {
  // Use id if unique
  if (element.id) {
    const byId = document.querySelectorAll(`#${CSS.escape(element.id)}`);
    if (byId.length === 1) {
      return `#${CSS.escape(element.id)}`;
    }
  }

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    let part = current.tagName.toLowerCase();

    // Add id if unique
    if (current.id) {
      const byId = document.querySelectorAll(`#${CSS.escape(current.id)}`);
      if (byId.length === 1) {
        parts.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
    }

    // Add meaningful classes (skip utility/generated classes)
    const meaningfulClasses = Array.from(current.classList)
      .filter((c) => !c.startsWith("__pd-") && c.length < 30)
      .slice(0, 2);

    if (meaningfulClasses.length > 0) {
      part += meaningfulClasses.map((c) => `.${CSS.escape(c)}`).join("");
    }

    // Add nth-of-type if needed for uniqueness among siblings
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (s) => s.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        part += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(part);
    current = current.parentElement;
  }

  if (parts.length === 0 || (parts[0] !== "body" && !parts[0].startsWith("#"))) {
    parts.unshift("body");
  }

  const selector = parts.join(" > ");

  // Validate - selector must match exactly our target element
  try {
    const matched = document.querySelector(selector);
    if (matched === element) {
      return selector;
    }
  } catch {
    // Invalid selector, fall through
  }

  // Fallback: full path with nth-of-type at every level
  return buildFullPath(element);
}

function buildFullPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    let part = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (s) => s.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        part += `:nth-of-type(${index})`;
      }
    }
    parts.unshift(part);
    current = current.parentElement;
  }

  parts.unshift("body");
  return parts.join(" > ");
}

/** Generate a human-readable breadcrumb for display */
export function generateBreadcrumb(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  let depth = 0;

  while (current && current !== document.documentElement && depth < 5) {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      part = `#${current.id}`;
    } else if (current.classList.length > 0) {
      const cls = Array.from(current.classList)
        .filter((c) => !c.startsWith("__pd-"))
        .slice(0, 1)
        .join(".");
      if (cls) part += `.${cls}`;
    }
    parts.unshift(part);
    current = current.parentElement;
    depth++;
  }

  // Prefix with "iframe >" if we're inside an iframe
  if (window !== window.top) {
    parts.unshift("iframe");
  }

  return parts.join(" > ");
}
