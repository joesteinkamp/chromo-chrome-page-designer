/**
 * Bridge between content script and side panel.
 * Reads computed styles from selected elements and sends to panel.
 * Receives style changes from panel and applies to elements.
 */

import { TRACKED_PROPERTIES } from "../shared/constants";
import { generateBreadcrumb, generateSelector } from "../shared/selector";
import { extractComponentInfo } from "./framework-detect";
import type { ElementData } from "../shared/types";

/** Track which Google Fonts have been injected to avoid duplicates */
const loadedGoogleFonts = new Set<string>();

/**
 * System/web-safe fonts that don't need Google Fonts loading.
 * Any font NOT in this set is assumed to be a Google Font candidate.
 */
const SYSTEM_FONT_NAMES = new Set([
  "arial", "helvetica", "georgia", "times new roman", "courier new",
  "verdana", "trebuchet ms", "system-ui", "monospace", "sans-serif",
  "serif", "cursive", "fantasy", "inherit", "initial", "unset",
]);

/** Extract Figma-relevant computed styles from an element */
export function extractElementData(element: Element): ElementData {
  const computed = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  const computedStyles: Record<string, string> = {};
  for (const prop of TRACKED_PROPERTIES) {
    computedStyles[prop] = computed.getPropertyValue(prop);
  }

  // Extract authored styles preserving original units (%, rem, vw, etc.)
  const authoredStyles = extractAuthoredStyles(element, TRACKED_PROPERTIES);

  const display = computed.display;
  const tag = element.tagName.toLowerCase();

  // Detect CSS custom properties (design tokens) for color properties
  let designTokens: Array<{ name: string; value: string }> = [];
  try { designTokens = extractDesignTokens(element); } catch { /* cross-origin or security restriction */ }

  // Extract framework component info (React/Vue/Svelte)
  let componentInfo: ElementData["componentInfo"];
  try { componentInfo = extractComponentInfo(element); } catch { /* */ }

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
    authoredStyles,
    hasTextContent: hasDirectText(element),
    isImage: tag === "img" || tag === "svg" || tag === "picture",
    isFlex: display === "flex" || display === "inline-flex",
    isGrid: display === "grid" || display === "inline-grid",
    outerHTML: element.outerHTML.slice(0, 2000),
    matchCount: countMatchingElements(element),
    designTokens,
    componentInfo,
  };
}

/** Apply a CSS property change to an element */
export function applyStyleToElement(
  element: HTMLElement,
  property: string,
  value: string
): void {
  // Auto-load Google Font when font-family is changed
  if (property === "font-family") {
    loadGoogleFontIfNeeded(value);
  }
  element.style.setProperty(property, value, "important");
}

/** Inject a Google Fonts stylesheet if the font hasn't been loaded yet */
function loadGoogleFontIfNeeded(family: string): void {
  const clean = family.replace(/^['"]|['"]$/g, "");
  if (SYSTEM_FONT_NAMES.has(clean.toLowerCase()) || loadedGoogleFonts.has(clean)) return;
  loadedGoogleFonts.add(clean);
  const encoded = clean.replace(/ /g, "+");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
  link.classList.add("__pd-google-font");
  document.head.appendChild(link);
}

/** Find all elements matching the same tag and classes as the given element */
export function findMatchingElements(element: Element): Element[] {
  const tag = element.tagName.toLowerCase();
  const classes = Array.from(element.classList).filter((c) => !c.startsWith("__pd-"));

  if (classes.length === 0) return [];

  // Build a selector from tag + all classes
  const selector = tag + classes.map((c) => `.${CSS.escape(c)}`).join("");

  try {
    const all = Array.from(document.querySelectorAll(selector));
    // Exclude the element itself
    return all.filter((el) => el !== element);
  } catch {
    return [];
  }
}

/** Count elements matching the same tag + classes */
function countMatchingElements(element: Element): number {
  return findMatchingElements(element).length;
}

/** Extract CSS custom properties (design tokens) that resolve to colors */
function extractDesignTokens(element: Element): Array<{ name: string; value: string }> {
  const tokens: Array<{ name: string; value: string }> = [];
  const seen = new Set<string>();

  // Walk up to :root to find custom properties
  try {
    const rootStyles = window.getComputedStyle(document.documentElement);
    // Check common color-related custom property patterns
    const styleSheets = document.styleSheets;
    for (let i = 0; i < styleSheets.length && tokens.length < 20; i++) {
      try {
        const rules = styleSheets[i].cssRules;
        for (let j = 0; j < rules.length && tokens.length < 20; j++) {
          const rule = rules[j];
          if (rule instanceof CSSStyleRule && rule.selectorText === ":root") {
            for (let k = 0; k < rule.style.length; k++) {
              const prop = rule.style[k];
              if (prop.startsWith("--")) {
                const value = rootStyles.getPropertyValue(prop).trim();
                // Check if it looks like a color value
                if (
                  !seen.has(prop) &&
                  (value.startsWith("#") ||
                    value.startsWith("rgb") ||
                    value.startsWith("hsl") ||
                    value === "transparent")
                ) {
                  seen.add(prop);
                  tokens.push({ name: prop, value });
                }
              }
            }
          }
        }
      } catch {
        // Cross-origin stylesheet
      }
    }
  } catch {
    // Security restrictions
  }

  return tokens;
}

/**
 * Extract authored style values preserving original units and CSS variables.
 * Checks inline style first (our extension's APPLY_STYLE values),
 * then scans matched CSS rules for var() references.
 */
function extractAuthoredStyles(element: Element, properties: readonly string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const el = element as HTMLElement;

  // 1. Check inline styles first (highest priority)
  for (const prop of properties) {
    const inline = el.style?.getPropertyValue(prop);
    result[prop] = inline || "";
  }

  // 2. Scan matched CSS rules for var() references on properties we haven't found yet
  const propsToCheck = properties.filter((p) => !result[p]);
  if (propsToCheck.length > 0) {
    try {
      const sheets = document.styleSheets;
      for (let i = sheets.length - 1; i >= 0; i--) {
        try {
          const rules = sheets[i].cssRules;
          for (let j = rules.length - 1; j >= 0; j--) {
            const rule = rules[j];
            if (rule instanceof CSSStyleRule && element.matches(rule.selectorText)) {
              for (const prop of propsToCheck) {
                if (result[prop]) continue; // already found
                const val = rule.style.getPropertyValue(prop);
                if (val && /var\(/.test(val)) {
                  result[prop] = val;
                }
              }
            }
          }
        } catch { /* cross-origin stylesheet */ }
      }
    } catch { /* security restriction */ }
  }

  return result;
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
