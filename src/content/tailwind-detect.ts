/**
 * Detect Tailwind CSS utility classes on elements.
 */

export interface TailwindInfo {
  /** Whether Tailwind CSS is detected on the page */
  detected: boolean;
  /** Tailwind utility classes on this element */
  utilityClasses: string[];
}

/** Cached detection result */
let tailwindDetectedCache: boolean | null = null;

/**
 * Check if page uses Tailwind by looking for common indicators:
 * - <link> or <style> with tailwind in content/url
 * - Elements with common Tailwind classes (flex, grid, p-4, mt-2, etc.)
 */
export function detectTailwind(): boolean {
  if (tailwindDetectedCache !== null) return tailwindDetectedCache;

  // Check <link> elements for Tailwind references
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  for (const link of links) {
    const href = (link as HTMLLinkElement).href || "";
    if (/tailwind/i.test(href)) {
      tailwindDetectedCache = true;
      return true;
    }
  }

  // Check <style> elements for Tailwind references
  const styles = document.querySelectorAll("style");
  for (const style of styles) {
    const text = style.textContent || "";
    // Tailwind's base layer or common generated comments
    if (/tailwind/i.test(text) || /@layer\s+(base|components|utilities)/.test(text)) {
      tailwindDetectedCache = true;
      return true;
    }
  }

  // Check for common Tailwind classes in the DOM
  const commonClasses = ["flex", "grid", "hidden", "block", "inline-flex", "relative", "absolute"];
  const sampleElements = document.querySelectorAll("body *");
  const limit = Math.min(sampleElements.length, 200);
  let twClassCount = 0;

  for (let i = 0; i < limit; i++) {
    const el = sampleElements[i];
    const classList = el.classList;
    for (const cls of commonClasses) {
      if (classList.contains(cls)) {
        twClassCount++;
      }
    }
    // Also check for pattern-based classes like p-4, mt-2, bg-blue-500
    for (const cls of classList) {
      if (/^(p|m|px|py|mx|my|mt|mr|mb|ml|pt|pr|pb|pl|w|h|text|bg|border|rounded|gap|space)-/.test(cls)) {
        twClassCount++;
      }
    }
    if (twClassCount >= 5) {
      tailwindDetectedCache = true;
      return true;
    }
  }

  tailwindDetectedCache = false;
  return false;
}

/**
 * Regex pattern matching Tailwind's naming conventions.
 * Matches utilities with optional responsive/state prefixes, negative values, and arbitrary values.
 */
const TAILWIND_PATTERN = /^(?:!)?(?:-)?(?:(?:sm|md|lg|xl|2xl|max-sm|max-md|max-lg|max-xl|max-2xl):)?(?:(?:hover|focus|active|disabled|visited|first|last|odd|even|group-hover|focus-within|focus-visible|dark|print|motion-safe|motion-reduce):)*(?:(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|w|min-w|max-w|h|min-h|max-h|size|text|font|leading|tracking|bg|from|via|to|border|border-t|border-r|border-b|border-l|rounded|rounded-t|rounded-r|rounded-b|rounded-l|rounded-tl|rounded-tr|rounded-bl|rounded-br|shadow|opacity|gap|gap-x|gap-y|space-x|space-y|inset|top|right|bottom|left|z|order|col-span|col-start|col-end|row-span|row-start|row-end|basis|grow|shrink|translate-x|translate-y|rotate|scale|skew-x|skew-y|origin|duration|delay|ease|animate|ring|ring-offset|divide-x|divide-y|outline|outline-offset|decoration|underline-offset|indent|columns|aspect|blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia|backdrop-blur|backdrop-brightness|backdrop-contrast|backdrop-grayscale|backdrop-hue-rotate|backdrop-invert|backdrop-opacity|backdrop-saturate|backdrop-sepia|accent|caret|scroll-m|scroll-mx|scroll-my|scroll-mt|scroll-mr|scroll-mb|scroll-ml|scroll-p|scroll-px|scroll-py|scroll-pt|scroll-pr|scroll-pb|scroll-pl)-(?:\[.+?\]|\d+(?:\/\d+)?(?:\.\d+)?|auto|full|screen|min|max|fit|px|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|none|tight|snug|normal|relaxed|loose|thin|extralight|light|medium|semibold|bold|extrabold|black|transparent|current|inherit|white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:\/\d+)?|flex|inline-flex|grid|inline-grid|block|inline-block|inline|hidden|contents|flow-root|table|table-caption|table-cell|table-column|table-column-group|table-footer-group|table-header-group|table-row-group|table-row|list-item|relative|absolute|fixed|sticky|static|isolate|isolation-auto|visible|invisible|collapse|overflow-auto|overflow-hidden|overflow-clip|overflow-scroll|overflow-visible|overflow-x-auto|overflow-x-hidden|overflow-x-clip|overflow-x-scroll|overflow-x-visible|overflow-y-auto|overflow-y-hidden|overflow-y-clip|overflow-y-scroll|overflow-y-visible|truncate|text-ellipsis|text-clip|whitespace-normal|whitespace-nowrap|whitespace-pre|whitespace-pre-line|whitespace-pre-wrap|whitespace-break-spaces|break-normal|break-words|break-all|break-keep|italic|not-italic|underline|overline|line-through|no-underline|uppercase|lowercase|capitalize|normal-case|antialiased|subpixel-antialiased|ordinal|slashed-zero|lining-nums|oldstyle-nums|proportional-nums|tabular-nums|diagonal-fractions|stacked-fractions|list-inside|list-outside|list-none|list-disc|list-decimal|float-right|float-left|float-none|clear-left|clear-right|clear-both|clear-none|object-contain|object-cover|object-fill|object-none|object-scale-down|object-bottom|object-center|object-left|object-left-bottom|object-left-top|object-right|object-right-bottom|object-right-top|object-top|flex-row|flex-row-reverse|flex-col|flex-col-reverse|flex-wrap|flex-wrap-reverse|flex-nowrap|items-start|items-end|items-center|items-baseline|items-stretch|justify-normal|justify-start|justify-end|justify-center|justify-between|justify-around|justify-evenly|justify-stretch|justify-items-start|justify-items-end|justify-items-center|justify-items-stretch|content-normal|content-center|content-start|content-end|content-between|content-around|content-evenly|content-baseline|content-stretch|place-content-center|place-content-start|place-content-end|place-content-between|place-content-around|place-content-evenly|place-content-baseline|place-content-stretch|place-items-start|place-items-end|place-items-center|place-items-baseline|place-items-stretch|place-self-auto|place-self-start|place-self-end|place-self-center|place-self-stretch|self-auto|self-start|self-end|self-center|self-stretch|self-baseline|pointer-events-none|pointer-events-auto|resize-none|resize-y|resize-x|resize|select-none|select-text|select-all|select-auto|cursor-auto|cursor-default|cursor-pointer|cursor-wait|cursor-text|cursor-move|cursor-help|cursor-not-allowed|cursor-none|cursor-context-menu|cursor-progress|cursor-cell|cursor-crosshair|cursor-vertical-text|cursor-alias|cursor-copy|cursor-no-drop|cursor-grab|cursor-grabbing|cursor-all-scroll|cursor-col-resize|cursor-row-resize|cursor-n-resize|cursor-e-resize|cursor-s-resize|cursor-w-resize|cursor-ne-resize|cursor-nw-resize|cursor-se-resize|cursor-sw-resize|cursor-ew-resize|cursor-ns-resize|cursor-nesw-resize|cursor-nwse-resize|cursor-zoom-in|cursor-zoom-out|scroll-auto|scroll-smooth|snap-start|snap-end|snap-center|snap-align-none|snap-normal|snap-always|snap-none|snap-x|snap-y|snap-both|snap-mandatory|snap-proximity|touch-auto|touch-none|touch-pan-x|touch-pan-left|touch-pan-right|touch-pan-y|touch-pan-up|touch-pan-down|touch-pinch-zoom|touch-manipulation|will-change-auto|will-change-scroll|will-change-contents|will-change-transform|sr-only|not-sr-only|transition|transition-none|transition-all|transition-colors|transition-opacity|transition-shadow|transition-transform|container|prose|aspect-auto|aspect-square|aspect-video)$/;

/**
 * Return classes that match Tailwind patterns.
 */
export function extractTailwindClasses(element: Element): string[] {
  const classes: string[] = [];
  for (const cls of element.classList) {
    if (cls.startsWith("__pd-")) continue;
    if (TAILWIND_PATTERN.test(cls)) {
      classes.push(cls);
    }
  }
  return classes;
}

/**
 * Common spacing scale: Tailwind spacing value -> px
 */
const SPACING_SCALE: Record<number, string> = {
  0: "0",
  1: "1",
  2: "2",
  4: "3",
  5: "4", // wait, let's do this properly
};

// Tailwind spacing: class suffix -> px value
const TW_SPACING: [string, number][] = [
  ["0", 0], ["px", 1], ["0.5", 2], ["1", 4], ["1.5", 6], ["2", 8], ["2.5", 10],
  ["3", 12], ["3.5", 14], ["4", 16], ["5", 20], ["6", 24], ["7", 28], ["8", 32],
  ["9", 36], ["10", 40], ["11", 44], ["12", 48], ["14", 56], ["16", 64],
  ["20", 80], ["24", 96], ["28", 112], ["32", 128], ["36", 144], ["40", 160],
  ["44", 176], ["48", 192], ["52", 208], ["56", 224], ["60", 240], ["64", 256],
  ["72", 288], ["80", 320], ["96", 384],
];

/** Reverse lookup: px value -> Tailwind suffix */
const pxToTwSpacing = new Map<number, string>(TW_SPACING.map(([s, px]) => [px, s]));

/** Common Tailwind color name -> hex mappings (subset) */
const TW_COLORS: Record<string, string> = {
  "#ef4444": "red-500", "#f97316": "orange-500", "#f59e0b": "amber-500",
  "#eab308": "yellow-500", "#84cc16": "lime-500", "#22c55e": "green-500",
  "#10b981": "emerald-500", "#14b8a6": "teal-500", "#06b6d4": "cyan-500",
  "#0ea5e9": "sky-500", "#3b82f6": "blue-500", "#6366f1": "indigo-500",
  "#8b5cf6": "violet-500", "#a855f7": "purple-500", "#d946ef": "fuchsia-500",
  "#ec4899": "pink-500", "#f43f5e": "rose-500",
  "#fef2f2": "red-50", "#fee2e2": "red-100", "#fca5a5": "red-300",
  "#f87171": "red-400", "#dc2626": "red-600", "#b91c1c": "red-700",
  "#eff6ff": "blue-50", "#dbeafe": "blue-100", "#93c5fd": "blue-300",
  "#60a5fa": "blue-400", "#2563eb": "blue-600", "#1d4ed8": "blue-700",
  "#f0fdf4": "green-50", "#dcfce7": "green-100", "#86efac": "green-300",
  "#4ade80": "green-400", "#16a34a": "green-600", "#15803d": "green-700",
  "#ffffff": "white", "#000000": "black", "#f9fafb": "gray-50",
  "#f3f4f6": "gray-100", "#e5e7eb": "gray-200", "#d1d5db": "gray-300",
  "#9ca3af": "gray-400", "#6b7280": "gray-500", "#4b5563": "gray-600",
  "#374151": "gray-700", "#1f2937": "gray-800", "#111827": "gray-900",
  "transparent": "transparent",
};

/** CSS property prefix mappings for spacing */
const SPACING_PROP_MAP: Record<string, string> = {
  "padding": "p",
  "padding-top": "pt",
  "padding-right": "pr",
  "padding-bottom": "pb",
  "padding-left": "pl",
  "margin": "m",
  "margin-top": "mt",
  "margin-right": "mr",
  "margin-bottom": "mb",
  "margin-left": "ml",
  "gap": "gap",
  "row-gap": "gap-y",
  "column-gap": "gap-x",
  "width": "w",
  "height": "h",
  "top": "top",
  "right": "right",
  "bottom": "bottom",
  "left": "left",
};

/** CSS color property -> Tailwind prefix */
const COLOR_PROP_MAP: Record<string, string> = {
  "color": "text",
  "background-color": "bg",
  "border-color": "border",
  "border-top-color": "border-t",
  "border-right-color": "border-r",
  "border-bottom-color": "border-b",
  "border-left-color": "border-l",
};

/** Font size mappings: px -> Tailwind class */
const FONT_SIZE_MAP: Record<string, string> = {
  "12px": "text-xs",
  "14px": "text-sm",
  "16px": "text-base",
  "18px": "text-lg",
  "20px": "text-xl",
  "24px": "text-2xl",
  "30px": "text-3xl",
  "36px": "text-4xl",
  "48px": "text-5xl",
  "60px": "text-6xl",
  "72px": "text-7xl",
  "96px": "text-8xl",
  "128px": "text-9xl",
};

/** Font weight mappings */
const FONT_WEIGHT_MAP: Record<string, string> = {
  "100": "font-thin",
  "200": "font-extralight",
  "300": "font-light",
  "400": "font-normal",
  "500": "font-medium",
  "600": "font-semibold",
  "700": "font-bold",
  "800": "font-extrabold",
  "900": "font-black",
};

/** Border radius: px -> Tailwind class */
const BORDER_RADIUS_MAP: Record<string, string> = {
  "0px": "rounded-none",
  "2px": "rounded-sm",
  "4px": "rounded",
  "6px": "rounded-md",
  "8px": "rounded-lg",
  "12px": "rounded-xl",
  "16px": "rounded-2xl",
  "24px": "rounded-3xl",
  "9999px": "rounded-full",
};

/**
 * Given a CSS property and value, suggest the Tailwind utility class.
 * Returns null for complex/uncommon values.
 */
export function suggestTailwindClass(property: string, value: string): string | null {
  const trimmed = value.trim();

  // Spacing properties (padding, margin, gap, width, height, positioning)
  const spacingPrefix = SPACING_PROP_MAP[property];
  if (spacingPrefix) {
    const px = parsePx(trimmed);
    if (px !== null) {
      const twSuffix = pxToTwSpacing.get(px);
      if (twSuffix !== undefined) {
        return `${spacingPrefix}-${twSuffix}`;
      }
    }
    if (trimmed === "auto") {
      return `${spacingPrefix}-auto`;
    }
    if (trimmed === "100%") {
      return `${spacingPrefix}-full`;
    }
    if (trimmed === "100vw" && property === "width") return "w-screen";
    if (trimmed === "100vh" && property === "height") return "h-screen";
  }

  // Color properties
  const colorPrefix = COLOR_PROP_MAP[property];
  if (colorPrefix) {
    const hex = normalizeToHex(trimmed);
    if (hex) {
      const twColor = TW_COLORS[hex];
      if (twColor) return `${colorPrefix}-${twColor}`;
    }
    if (trimmed === "transparent") return `${colorPrefix}-transparent`;
  }

  // Font size
  if (property === "font-size") {
    return FONT_SIZE_MAP[trimmed] || null;
  }

  // Font weight
  if (property === "font-weight") {
    return FONT_WEIGHT_MAP[trimmed] || null;
  }

  // Border radius
  if (property === "border-radius") {
    return BORDER_RADIUS_MAP[trimmed] || null;
  }

  // Display
  if (property === "display") {
    const displayMap: Record<string, string> = {
      "flex": "flex", "inline-flex": "inline-flex", "grid": "grid",
      "inline-grid": "inline-grid", "block": "block", "inline-block": "inline-block",
      "inline": "inline", "none": "hidden", "contents": "contents",
      "table": "table", "flow-root": "flow-root",
    };
    return displayMap[trimmed] || null;
  }

  // Opacity
  if (property === "opacity") {
    const pct = Math.round(parseFloat(trimmed) * 100);
    if ([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100].includes(pct)) {
      return `opacity-${pct}`;
    }
  }

  // Text alignment
  if (property === "text-align") {
    const alignMap: Record<string, string> = {
      "left": "text-left", "center": "text-center", "right": "text-right", "justify": "text-justify",
    };
    return alignMap[trimmed] || null;
  }

  // Position
  if (property === "position") {
    const posMap: Record<string, string> = {
      "static": "static", "fixed": "fixed", "absolute": "absolute",
      "relative": "relative", "sticky": "sticky",
    };
    return posMap[trimmed] || null;
  }

  // Overflow
  if (property === "overflow") {
    const ovMap: Record<string, string> = {
      "auto": "overflow-auto", "hidden": "overflow-hidden",
      "visible": "overflow-visible", "scroll": "overflow-scroll",
    };
    return ovMap[trimmed] || null;
  }

  return null;
}

/** Parse a pixel value string to a number, or return null */
function parsePx(value: string): number | null {
  const m = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  return m ? parseFloat(m[1]) : null;
}

/** Normalize a CSS color to lowercase hex, or return null */
function normalizeToHex(value: string): string | null {
  const trimmed = value.trim().toLowerCase();

  // Already hex
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    // Expand shorthand
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }

  // rgb(r, g, b)
  const m = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  if (trimmed === "transparent") return "transparent";
  return null;
}
