/**
 * Generate a unique CSS selector for a DOM element.
 * Produces readable selectors suitable for developer handoff.
 */
export function generateSelector(element: Element): string {
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

  return parts.join(" > ");
}
