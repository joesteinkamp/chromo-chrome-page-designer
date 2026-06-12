/**
 * Bridge between content script and side panel.
 * Reads computed styles from selected elements and sends to panel.
 * Receives style changes from panel and applies to elements.
 */

import { TRACKED_PROPERTIES } from "../shared/constants";
import { generateBreadcrumb, generateSelector } from "../shared/selector";
import { extractComponentInfo } from "./framework-detect";
import { detectTailwind, extractTailwindClasses, normalizeToHex } from "./tailwind-detect";
import type { ElementData, PageToken } from "../shared/types";

/** Track which Google Fonts have been injected to avoid duplicates */
const loadedGoogleFonts = new Set<string>();

/** Cached page colors — extracted once per page load */
let cachedPageColors: string[] | null = null;

/** Cached page values — extracted once per page load */
let cachedPageValues: ElementData["pageValues"] | null = null;

/**
 * System/web-safe fonts that don't need Google Fonts loading.
 * Any font NOT in this set is assumed to be a Google Font candidate.
 */
const SYSTEM_FONT_NAMES = new Set([
  "arial", "helvetica", "georgia", "times new roman", "courier new",
  "verdana", "trebuchet ms", "system-ui", "monospace", "sans-serif",
  "serif", "cursive", "fantasy", "inherit", "initial", "unset",
]);

/** Properties whose values are colors and may need resolution for functions like color-mix() */
const COLOR_VALUED_PROPS = new Set<string>([
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "fill",
  "stroke",
]);

/**
 * Resolve a computed CSS color value to a concrete rgb()/rgba() string.
 *
 * Chrome's getComputedStyle can return unresolved forms like
 * `color-mix(in srgb, var(--x), #0f1930 28%)` or modern color functions
 * (`oklch()`, `lab()`, `color()`) that the panel's simple parser can't read.
 * Setting the value inline on a temp element forces the engine to resolve
 * var() in the page's variable scope and serialize to rgb/rgba.
 */
function resolveColorValue(value: string, context: Element): string {
  if (!value) return value;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "transparent" || trimmed === "currentcolor" || trimmed === "none") return value;
  // SVG paint server references (e.g. url(#gradient)) aren't colors — keep as-is.
  if (/^url\(/i.test(trimmed)) return value;
  // Already in a format the panel understands.
  if (/^#[0-9a-fA-F]+$/.test(trimmed)) return value;
  if (/^rgba?\(/i.test(trimmed)) return value;
  if (/^hsla?\(/i.test(trimmed)) return value;

  const parent = context.parentElement || document.body;
  if (!parent) return value;
  try {
    const temp = document.createElement("span");
    temp.className = "__pd-color-resolver";
    temp.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;";
    temp.style.setProperty("background-color", value);
    parent.appendChild(temp);
    const resolved = window.getComputedStyle(temp).backgroundColor;
    temp.remove();
    return resolved || value;
  } catch {
    return value;
  }
}

/** Extract Figma-relevant computed styles from an element */
export function extractElementData(element: Element): ElementData {
  const computed = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  const computedStyles: Record<string, string> = {};
  for (const prop of TRACKED_PROPERTIES) {
    const raw = computed.getPropertyValue(prop);
    computedStyles[prop] = COLOR_VALUED_PROPS.has(prop) ? resolveColorValue(raw, element) : raw;
  }

  // Extract authored styles preserving original units (%, rem, vw, etc.)
  const authoredStyles = extractAuthoredStyles(element, TRACKED_PROPERTIES);

  const display = computed.display;
  const tag = element.tagName.toLowerCase();

  // Detect CSS custom properties (design tokens) for color properties
  let designTokens: Array<{ name: string; value: string }> = [];
  try { designTokens = extractDesignTokens(element); } catch { /* cross-origin or security restriction */ }

  // Extract page colors (cached — only computed once per page)
  if (!cachedPageColors) {
    try { cachedPageColors = extractPageColors(); } catch { cachedPageColors = []; }
  }

  // Extract page values (cached — only computed once per page)
  if (!cachedPageValues) {
    try { cachedPageValues = extractPageValues(); }
    catch { cachedPageValues = { spacing: [], radius: [], strokeWidth: [] }; }
  }

  // Detect Tailwind CSS
  let tailwindDetected = false;
  let tailwindClasses: string[] = [];
  try {
    tailwindDetected = detectTailwind();
    if (tailwindDetected) {
      tailwindClasses = extractTailwindClasses(element);
    }
  } catch { /* */ }

  // Extract CSS variable references from authored styles
  const cssVariables: Record<string, string> = {};
  for (const [prop, val] of Object.entries(authoredStyles)) {
    if (val && /var\(/.test(val)) {
      cssVariables[prop] = val;
    }
  }

  // Extract framework component info (React/Vue/Svelte)
  let componentInfo: ElementData["componentInfo"];
  try { componentInfo = extractComponentInfo(element); } catch { /* */ }

  // Resolve which rule supplies each property (cascade visibility). The full
  // stylesheet walk is too costly per slider tick, so results are cached
  // briefly per element — selection changes recompute, drags hit the cache.
  let styleSources: ElementData["styleSources"];
  const cachedSources = styleSourcesCache.get(element);
  if (cachedSources && Date.now() - cachedSources.time < STYLE_SOURCES_TTL_MS) {
    styleSources = cachedSources.sources;
  } else {
    try {
      styleSources = extractStyleSources(element, TRACKED_PROPERTIES);
      styleSourcesCache.set(element, { time: Date.now(), sources: styleSources });
    } catch { /* */ }
  }

  // Capture parent layout context so the panel can show position controls
  // only when the element is free-positioned (parent is not auto-layout).
  let parentLayout: ElementData["parentLayout"];
  const parent = element.parentElement;
  if (parent && parent !== document.documentElement) {
    const parentRect = parent.getBoundingClientRect();
    parentLayout = {
      display: window.getComputedStyle(parent).display,
      rect: {
        x: parentRect.x,
        y: parentRect.y,
        width: parentRect.width,
        height: parentRect.height,
      },
    };
  }

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
    parentLayout,
    breadcrumb: generateBreadcrumb(element),
    computedStyles,
    authoredStyles,
    hasTextContent: hasDirectText(element),
    isImage: tag === "img" || tag === "svg" || tag === "picture",
    isSvg: element instanceof SVGElement,
    isFlex: display === "flex" || display === "inline-flex",
    isGrid: display === "grid" || display === "inline-grid",
    outerHTML: element.outerHTML.slice(0, 2000),
    matchCount: countMatchingElements(element),
    designTokens,
    pageColors: cachedPageColors || [],
    pageValues: cachedPageValues || { spacing: [], radius: [], strokeWidth: [] },
    tailwindClasses: tailwindClasses.length > 0 ? tailwindClasses : undefined,
    tailwindDetected: tailwindDetected || undefined,
    cssVariables: Object.keys(cssVariables).length > 0 ? cssVariables : undefined,
    styleSources,
    componentInfo,
  };
}

/**
 * Find a design token (CSS variable) on the page whose value matches the
 * given color value. Lets the export say "use var(--brand-primary)" instead
 * of a hex literal when the designer picked a color that already exists as a
 * token.
 */
export function findMatchingToken(element: Element, value: string): string | null {
  const target = normalizeColor(value, element);
  if (!target) return null;
  let tokens: Array<{ name: string; value: string }>;
  try { tokens = extractDesignTokens(element); } catch { return null; }
  for (const token of tokens) {
    if (normalizeColor(token.value, element) === target) return token.name;
  }
  return null;
}

/** Normalize any CSS color to comparable lowercase hex (shared canonical form) */
function normalizeColor(value: string, context: Element): string | null {
  return normalizeToHex(resolveColorValue(value, context));
}

// --- Style cascade sources ---------------------------------------------------

/** Short-lived per-element cache for extractStyleSources results */
const styleSourcesCache = new WeakMap<Element, { time: number; sources: ElementData["styleSources"] }>();
const STYLE_SOURCES_TTL_MS = 1000;

/**
 * Resolve which CSS rule wins the cascade for each tracked property, so the
 * inspector can show "Fill comes from `.btn-primary` in theme.css" and the
 * export can target the right rule instead of overriding it blindly.
 *
 * Approximation of the real cascade: !important > inline > specificity >
 * source order. Cross-origin sheets are skipped (their declarations can't be
 * read), so a property may show a lower-priority source on such pages.
 */
function extractStyleSources(
  element: Element,
  properties: readonly string[]
): Record<string, NonNullable<ElementData["styleSources"]>[string]> {
  const best: Record<string, { source: NonNullable<ElementData["styleSources"]>[string]; score: number }> = {};
  let order = 0;

  const visitRules = (rules: CSSRuleList, sheetLabel: string | null) => {
    for (let j = 0; j < rules.length; j++) {
      const rule = rules[j];
      // Descend into matching @media / @supports groups
      if (rule instanceof CSSMediaRule) {
        try {
          if (window.matchMedia(rule.conditionText).matches) visitRules(rule.cssRules, sheetLabel);
        } catch { /* unparsable condition */ }
        continue;
      }
      if (!(rule instanceof CSSStyleRule)) {
        if ("cssRules" in rule) {
          try { visitRules((rule as CSSGroupingRule).cssRules, sheetLabel); } catch { /* */ }
        }
        continue;
      }
      order++;
      let matched: string | null = null;
      try {
        if (!element.matches(rule.selectorText)) continue;
        // Find the specific complex selector that matched, for specificity
        for (const part of rule.selectorText.split(",")) {
          try {
            if (element.matches(part.trim())) { matched = part.trim(); break; }
          } catch { /* invalid fragment */ }
        }
      } catch { continue; }
      const spec = selectorSpecificity(matched ?? rule.selectorText);
      for (const prop of properties) {
        const val = rule.style.getPropertyValue(prop);
        if (!val) continue;
        const important = rule.style.getPropertyPriority(prop) === "important";
        const score = (important ? 1e12 : 0) + spec * 1e6 + order;
        if (!best[prop] || score > best[prop].score) {
          best[prop] = {
            score,
            source: { selector: matched ?? rule.selectorText, sheet: sheetLabel, important },
          };
        }
      }
    }
  };

  try {
    const sheets = document.styleSheets;
    for (let i = 0; i < sheets.length; i++) {
      let rules: CSSRuleList;
      try { rules = sheets[i].cssRules; } catch { continue; } // cross-origin
      let label: string | null = null;
      const href = sheets[i].href;
      if (href) {
        try { label = new URL(href).pathname.split("/").pop() || href; } catch { label = href; }
      }
      visitRules(rules, label);
    }
  } catch { /* security restriction */ }

  // Inline styles: non-important inline beats all non-important rules;
  // !important inline (our own edits) beats everything.
  const inlineStyle = (element as HTMLElement).style;
  if (inlineStyle) {
    for (const prop of properties) {
      const val = inlineStyle.getPropertyValue(prop);
      if (!val) continue;
      const important = inlineStyle.getPropertyPriority(prop) === "important";
      const score = important ? 2e12 : 0.9e12;
      if (!best[prop] || score > best[prop].score) {
        best[prop] = {
          score,
          source: { selector: "", sheet: null, important, inline: true },
        };
      }
    }
  }

  const result: Record<string, NonNullable<ElementData["styleSources"]>[string]> = {};
  for (const [prop, entry] of Object.entries(best)) {
    result[prop] = entry.source;
  }
  return result;
}

/** Approximate CSS specificity as a single comparable number */
function selectorSpecificity(selector: string): number {
  const ids = (selector.match(/#[\w-]+/g) || []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+(\([^)]*\))?/g) || []).length;
  const types =
    (selector.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length +
    (selector.match(/::[\w-]+/g) || []).length;
  return Math.min(ids, 99) * 10000 + Math.min(classes, 99) * 100 + Math.min(types, 99);
}

// --- Design token (CSS variable) editing -----------------------------------

/** Live token overrides applied via the injected :root stylesheet */
const tokenOverrides = new Map<string, string>();

const TOKEN_OVERRIDE_STYLE_ID = "__pd-token-overrides";

/**
 * Override (or clear, with null) a CSS custom property on :root. Overrides
 * live in a single injected <style> appended to the document so they win the
 * cascade; editing one token live-restyles everything that consumes it.
 */
export function setTokenOverride(name: string, value: string | null): void {
  if (value === null) {
    tokenOverrides.delete(name);
  } else {
    tokenOverrides.set(name, value);
  }
  // Token values changed — cached extractions are stale
  cachedDesignTokens = null;
  let styleEl = document.getElementById(TOKEN_OVERRIDE_STYLE_ID) as HTMLStyleElement | null;
  if (tokenOverrides.size === 0) {
    styleEl?.remove();
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = TOKEN_OVERRIDE_STYLE_ID;
    document.documentElement.appendChild(styleEl);
  }
  const decls = Array.from(tokenOverrides.entries())
    .map(([n, v]) => `  ${n}: ${v} !important;`)
    .join("\n");
  styleEl.textContent = `:root {\n${decls}\n}`;
}

/** Current effective value of a token: live override, else computed on :root */
export function getTokenValue(name: string): string {
  const override = tokenOverrides.get(name);
  if (override !== undefined) return override;
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function looksLikeColor(value: string): boolean {
  return /^(#|rgb|hsl|oklch|oklab|lab|lch|color\()/i.test(value) || value === "transparent";
}

/**
 * Collect CSS custom properties declared on :root/html across same-origin
 * stylesheets, with their current computed values.
 */
export function collectPageTokens(): PageToken[] {
  const names = new Set<string>();
  try {
    const sheets = document.styleSheets;
    for (let i = 0; i < sheets.length && names.size < 150; i++) {
      try {
        const rules = sheets[i].cssRules;
        for (let j = 0; j < rules.length && names.size < 150; j++) {
          const rule = rules[j];
          if (!(rule instanceof CSSStyleRule)) continue;
          if (!/(^|,)\s*(:root|html)\s*($|,)/.test(rule.selectorText)) continue;
          for (let k = 0; k < rule.style.length; k++) {
            const prop = rule.style[k];
            if (prop.startsWith("--")) names.add(prop);
          }
        }
      } catch { /* cross-origin stylesheet */ }
    }
  } catch { /* security restriction */ }

  const rootStyles = window.getComputedStyle(document.documentElement);
  const tokens: PageToken[] = [];
  for (const name of names) {
    const value = (tokenOverrides.get(name) ?? rootStyles.getPropertyValue(name)).trim();
    if (!value) continue;
    tokens.push({ name, value, isColor: looksLikeColor(value) });
  }
  // Colors first, then alphabetical — matches what designers reach for
  tokens.sort((a, b) =>
    a.isColor === b.isColor ? a.name.localeCompare(b.name) : a.isColor ? -1 : 1
  );
  return tokens.slice(0, 100);
}

/** Apply a CSS property change to an element */
export function applyStyleToElement(
  element: HTMLElement | SVGElement,
  property: string,
  value: string
): void {
  // Auto-load Google Font when font-family is changed
  if (property === "font-family") {
    loadGoogleFontIfNeeded(value);
  }
  element.style.setProperty(property, value, "important");
}

/**
 * Flex/grid configuration properties that only have meaning while a container
 * uses auto layout. Removing them keeps the exported changeset clean once the
 * layout is gone.
 */
const AUTO_LAYOUT_AUX_PROPERTIES = [
  "flex-direction",
  "flex-wrap",
  "flex-flow",
  "justify-content",
  "align-items",
  "align-content",
  "place-items",
  "place-content",
  "gap",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "grid-template-rows",
  "grid-template-areas",
  "grid-auto-flow",
  "grid-auto-columns",
  "grid-auto-rows",
];

/**
 * Remove flex/grid auto layout from an element, reverting it to normal flow.
 *
 * If `display` was set inline (e.g. via "Add auto layout"), the inline value is
 * dropped so the element falls back to its natural display. Otherwise the
 * layout comes from the page's own stylesheet, so `display: block` is forced to
 * override it. Auxiliary flex/grid properties set inline are also stripped.
 *
 * Returns the list of property changes made so callers can record them for undo.
 */
export function removeAutoLayout(
  element: HTMLElement | SVGElement
): Array<{ property: string; from: string; to: string }> {
  const changes: Array<{ property: string; from: string; to: string }> = [];
  const computed = window.getComputedStyle(element);

  const fromDisplay = computed.getPropertyValue("display");
  if (element.style.getPropertyValue("display")) {
    element.style.removeProperty("display");
    changes.push({ property: "display", from: fromDisplay, to: "" });
  } else {
    element.style.setProperty("display", "block", "important");
    changes.push({ property: "display", from: fromDisplay, to: "block" });
  }

  for (const prop of AUTO_LAYOUT_AUX_PROPERTIES) {
    const inlineVal = element.style.getPropertyValue(prop);
    if (!inlineVal) continue;
    element.style.removeProperty(prop);
    changes.push({ property: prop, from: inlineVal, to: "" });
  }

  return changes;
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

/** Cached color tokens — the :root walk is too costly to repeat per slider tick */
let cachedDesignTokens: Array<{ name: string; value: string }> | null = null;

/** Extract CSS custom properties (design tokens) that resolve to colors */
function extractDesignTokens(element: Element): Array<{ name: string; value: string }> {
  if (cachedDesignTokens) return cachedDesignTokens;
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

  cachedDesignTokens = tokens;
  return tokens;
}

/**
 * Extract authored style values preserving original units and CSS variables.
 * Checks inline style first (our extension's APPLY_STYLE values),
 * then scans matched CSS rules for any explicit declaration (preserving
 * original units like %, rem, vw, and var() references).
 *
 * Note: rule-order walk (last sheet → last rule) approximates cascade order
 * for the common case but does not account for CSS specificity.
 */
function extractAuthoredStyles(element: Element, properties: readonly string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const el = element as HTMLElement;

  // 1. Check inline styles first (highest priority)
  for (const prop of properties) {
    const inline = el.style?.getPropertyValue(prop);
    result[prop] = inline || "";
  }

  // 2. Scan matched CSS rules for any explicit value on properties we haven't found yet
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
                if (val) {
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

/** Color properties to read from computed styles */
const COLOR_PROPS = [
  "color", "background-color",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
];

/** Convert rgb/rgba string to hex */
function rgbToHex(rgb: string): string | null {
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Skip these common/boring colors */
const SKIP_COLORS = new Set([
  "#000000", "#ffffff", "#000", "#fff",
  "rgba(0, 0, 0, 0)", "transparent",
]);

/** Numerical properties grouped by category for page-value extraction */
const SPACING_PROPS = [
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "gap", "row-gap", "column-gap",
];
const RADIUS_PROPS = [
  "border-top-left-radius", "border-top-right-radius",
  "border-bottom-right-radius", "border-bottom-left-radius",
];
const STROKE_PROPS = [
  "border-top-width", "border-right-width",
  "border-bottom-width", "border-left-width",
];

/** Parse a CSS length in px. Returns null for NaN / <=0 / >2000; rounds to 1 decimal for dedupe. */
function parsePxValue(raw: string): number | null {
  if (!raw) return null;
  const n = parseFloat(raw);
  if (isNaN(n) || n <= 0 || n > 2000) return null;
  return Math.round(n * 10) / 10;
}

/**
 * Walk visible DOM elements and extract unique numerical values from computed styles,
 * grouped by usage (spacing, radius, stroke width).
 */
function extractPageValues(): ElementData["pageValues"] {
  const spacing = new Set<number>();
  const radius = new Set<number>();
  const strokeWidth = new Set<number>();

  const elements = document.querySelectorAll("body *");
  const limit = Math.min(elements.length, 500);

  for (let i = 0; i < limit; i++) {
    const el = elements[i];
    if ((el as HTMLElement).offsetParent === null) continue;
    if (el.className && typeof el.className === "string" && el.className.includes("__pd-")) continue;

    const computed = window.getComputedStyle(el);

    if (spacing.size < 24) {
      for (const prop of SPACING_PROPS) {
        const v = parsePxValue(computed.getPropertyValue(prop));
        if (v !== null) spacing.add(v);
      }
    }
    if (radius.size < 24) {
      for (const prop of RADIUS_PROPS) {
        const v = parsePxValue(computed.getPropertyValue(prop));
        if (v !== null) radius.add(v);
      }
    }
    if (strokeWidth.size < 24) {
      for (const prop of STROKE_PROPS) {
        const v = parsePxValue(computed.getPropertyValue(prop));
        if (v !== null) strokeWidth.add(v);
      }
    }
  }

  const sortAndCap = (s: Set<number>) => Array.from(s).sort((a, b) => a - b).slice(0, 12);
  return {
    spacing: sortAndCap(spacing),
    radius: sortAndCap(radius),
    strokeWidth: sortAndCap(strokeWidth),
  };
}

/**
 * Walk visible DOM elements and extract unique colors from computed styles.
 * Works regardless of cross-origin stylesheets since getComputedStyle
 * always returns resolved values.
 */
function extractPageColors(): string[] {
  const colors = new Set<string>();
  const elements = document.querySelectorAll("body *");
  const limit = Math.min(elements.length, 500); // cap for performance

  for (let i = 0; i < limit && colors.size < 30; i++) {
    const el = elements[i];
    if ((el as HTMLElement).offsetParent === null && (el as HTMLElement).style?.display !== "fixed") continue; // skip hidden
    if (el.className && typeof el.className === "string" && el.className.includes("__pd-")) continue; // skip our overlays

    const computed = window.getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const val = computed.getPropertyValue(prop);
      if (!val || SKIP_COLORS.has(val)) continue;

      const hex = rgbToHex(val);
      if (hex && !SKIP_COLORS.has(hex)) {
        colors.add(hex);
      }
    }
  }

  return Array.from(colors).slice(0, 24);
}
