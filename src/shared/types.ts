/** Info about a selected DOM element, sent from content script to side panel */
export interface ElementData {
  /** CSS selector uniquely identifying this element */
  selector: string;
  /** Frame ID (0 = top frame, non-zero = iframe). Used for routing messages. */
  frameId?: number;
  /** Tag name (lowercase) */
  tag: string;
  /** Element id attribute (empty string if none) */
  id: string;
  /** Class list */
  classes: string[];
  /** Bounding rect relative to viewport */
  rect: { x: number; y: number; width: number; height: number };
  /** Parent layout context — used by the panel to decide whether the element
   *  is laid out by an auto-layout (flex/grid) parent or free-positioned. */
  parentLayout?: {
    display: string;
    rect: { x: number; y: number; width: number; height: number };
  };
  /** Breadcrumb path e.g. "body > main > .hero > h1" */
  breadcrumb: string;
  /** Breadcrumb segments with a resolvable selector each, for clickable
   *  ancestor navigation. The last entry is the selected element itself. */
  breadcrumbTrail?: Array<{ label: string; selector: string }>;
  /** Key computed styles (Figma-relevant subset) — always in resolved px */
  computedStyles: Record<string, string>;
  /** Authored style values preserving original units (%, rem, etc.) */
  authoredStyles: Record<string, string>;
  /** Whether element contains direct text content */
  hasTextContent: boolean;
  /** Whether element is an image */
  isImage: boolean;
  /** Whether element is an SVG element (uses fill/stroke instead of background/border) */
  isSvg: boolean;
  /** Whether element uses display:flex */
  isFlex: boolean;
  /** Whether element uses display:grid */
  isGrid: boolean;
  /** Truncated outerHTML for context */
  outerHTML: string;
  /** Number of matching elements (same tag + classes) on the page */
  matchCount: number;
  /** CSS custom properties (design tokens) used on this element */
  designTokens: Array<{ name: string; value: string }>;
  /** Unique color values found across the page's stylesheets */
  pageColors: string[];
  /** Unique numerical values (px) found on the page, grouped by usage */
  pageValues: {
    spacing: number[];     // padding / margin / gap
    radius: number[];      // border-*-radius
    strokeWidth: number[]; // border-*-width
  };
  /** Tailwind CSS utility classes on this element */
  tailwindClasses?: string[];
  /** Whether Tailwind CSS is detected on the page */
  tailwindDetected?: boolean;
  /** CSS variable references for properties (property -> "var(--name)") */
  cssVariables?: Record<string, string>;
  /** Which CSS rule wins the cascade for each property — shows where a value
   *  comes from so the developer/agent edits the right rule */
  styleSources?: Record<string, {
    /** The matching complex selector of the winning rule (empty for inline) */
    selector: string;
    /** Stylesheet filename, or null for <style> blocks / inline */
    sheet: string | null;
    important: boolean;
    /** True when the winning declaration is the element's inline style */
    inline?: boolean;
  }>;
  /** Component info from framework detection (React/Vue/Svelte) */
  componentInfo?: {
    framework: "react" | "vue" | "svelte" | null;
    componentName: string | null;
    componentHierarchy: string[];
    sourceFile: string | null;
    sourceLine: number | null;
    props?: Array<{
      name: string;
      value: string | number | boolean | null;
      type: "string" | "number" | "boolean" | "null";
    }>;
    /** Possible enum values for string props (from propTypes or sibling analysis) */
    enumValues?: Record<string, string[]>;
  };
}

/** Editor state shared across contexts */
export interface EditorState {
  isActive: boolean;
  selectedElement: ElementData | null;
}

/** A tracked change */
export type Change =
  | StyleChange
  | TextChange
  | MoveChange
  | ResizeChange
  | ImageChange
  | DeleteChange
  | HideChange
  | WrapChange
  | DuplicateChange
  | CommentChange
  | PropChange
  | TokenChange;

export interface BaseChange {
  id: string;
  timestamp: number;
  selector: string;
  /** Human-readable description */
  description: string;
  /** Groups related changes (e.g. multi-edit) for batch undo */
  batchId?: string;
  /** Page viewport width (CSS px) when the change was made — used to scope
   *  changes made at mobile/tablet sizes to responsive breakpoints on export */
  viewport?: number;
}

export interface StyleChange extends BaseChange {
  type: "style";
  property: string;
  from: string;
  to: string;
  /** Suggested Tailwind utility class for the new value (when Tailwind is detected) */
  tailwindAdd?: string;
  /** Existing Tailwind class on the element that the suggestion replaces */
  tailwindRemove?: string;
  /** Design token (CSS variable) whose value matches the new value */
  matchedToken?: string;
}

export interface TextChange extends BaseChange {
  type: "text";
  from: string;
  to: string;
}

export interface MoveChange extends BaseChange {
  type: "move";
  fromParent: string;
  fromIndex: number;
  toParent: string;
  toIndex: number;
}

export interface ResizeChange extends BaseChange {
  type: "resize";
  from: { width: string; height: string };
  to: { width: string; height: string };
}

export interface ImageChange extends BaseChange {
  type: "image";
  from: string;
  to: string;
}

export interface DeleteChange extends BaseChange {
  type: "delete";
  /** HTML of the removed element for undo */
  html: string;
  parentSelector: string;
  index: number;
}

export interface HideChange extends BaseChange {
  type: "hide";
  previousDisplay: string;
}

export interface WrapChange extends BaseChange {
  type: "wrap";
  /** Selector of the wrapper div that was created */
  wrapperSelector: string;
}

export interface DuplicateChange extends BaseChange {
  type: "duplicate";
  /** Selector of the cloned element */
  cloneSelector: string;
  /**
   * Selector of the element the clone was inserted relative to. Omitted for
   * plain duplicates (insertion point is the original); set for clipboard
   * pastes, where the destination differs from the copied element.
   */
  targetSelector?: string;
  /**
   * How the clone was inserted relative to the target: as the next sibling
   * ("after", the default) or as its last child ("append" — paste into a
   * selected container).
   */
  insertMode?: "after" | "append";
}

/**
 * A freeform instruction attached to an element for the downstream AI coding
 * tool. Not a visual change — used when the desired edit isn't expressible as
 * a style tweak (e.g. "use a dropdown instead of buttons").
 */
export interface CommentChange extends BaseChange {
  type: "comment";
  /** The instruction text */
  text: string;
  /** Session-wide enumeration (1, 2, 3…) shown in the badge */
  number: number;
}

/**
 * A framework component prop edit (React/Vue/Svelte) — maps 1:1 to a source
 * code change (e.g. `variant="secondary"` → `variant="primary"`), unlike a
 * CSS override.
 */
export interface PropChange extends BaseChange {
  type: "prop";
  framework: "react" | "vue" | "svelte";
  componentName: string;
  propName: string;
  from: string | number | boolean | null;
  fromType: "string" | "number" | "boolean" | "null";
  to: string | number | boolean | null;
  toType: "string" | "number" | "boolean" | "null";
}

/**
 * A page-wide design token (CSS custom property) edit, applied by overriding
 * the variable on :root. One token edit can restyle the whole page — exports
 * as "change the token definition" rather than per-element CSS.
 */
export interface TokenChange extends BaseChange {
  type: "token";
  /** Custom property name, e.g. "--color-primary" */
  name: string;
  from: string;
  to: string;
}

/** A CSS custom property defined on :root, surfaced in the Tokens tab */
export interface PageToken {
  name: string;
  value: string;
  isColor: boolean;
}

/** Exported changeset format for Claude Code / Codex */
export interface Changeset {
  url: string;
  timestamp: string;
  description: string;
  changes: Change[];
}
