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
  /** Breadcrumb path e.g. "body > main > .hero > h1" */
  breadcrumb: string;
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
  | CommentChange;

export interface BaseChange {
  id: string;
  timestamp: number;
  selector: string;
  /** Human-readable description */
  description: string;
  /** Groups related changes (e.g. multi-edit) for batch undo */
  batchId?: string;
}

export interface StyleChange extends BaseChange {
  type: "style";
  property: string;
  from: string;
  to: string;
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

/** Exported changeset format for Claude Code / Codex */
export interface Changeset {
  url: string;
  timestamp: string;
  description: string;
  changes: Change[];
}
