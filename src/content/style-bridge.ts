/**
 * Bridge between content script and side panel.
 * Reads computed styles from selected elements and sends to panel.
 * Receives style changes from panel and applies to elements.
 */

import { TRACKED_PROPERTIES } from "../shared/constants";
import { generateBreadcrumb, generateSelector } from "../shared/selector";
import type { ElementData } from "../shared/types";

/** Extract Figma-relevant computed styles from an element */
export function extractElementData(element: Element): ElementData {
  const computed = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  const computedStyles: Record<string, string> = {};
  for (const prop of TRACKED_PROPERTIES) {
    computedStyles[prop] = computed.getPropertyValue(prop);
  }

  const display = computed.display;
  const tag = element.tagName.toLowerCase();

  return {
    selector: generateSelector(element),
    tag,
    id: element.id || "",
    classes: Array.from(element.classList).filter((c) => !c.startsWith("__pd-")),
    rect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    breadcrumb: generateBreadcrumb(element),
    computedStyles,
    hasTextContent: hasDirectText(element),
    isImage: tag === "img" || tag === "svg" || tag === "picture",
    isFlex: display === "flex" || display === "inline-flex",
    isGrid: display === "grid" || display === "inline-grid",
    outerHTML: element.outerHTML.slice(0, 2000),
  };
}

/** Apply a CSS property change to an element */
export function applyStyleToElement(
  element: HTMLElement,
  property: string,
  value: string
): void {
  element.style.setProperty(property, value, "important");
}

/** Check if element has direct text nodes (not just child elements) */
function hasDirectText(element: Element): boolean {
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      return true;
    }
  }
  return false;
}
