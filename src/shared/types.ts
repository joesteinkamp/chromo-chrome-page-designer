/** Info about a selected DOM element, sent from content script to side panel */
export interface ElementData {
  /** CSS selector uniquely identifying this element */
  selector: string;
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
  /** Key computed styles (Figma-relevant subset) */
  computedStyles: Record<string, string>;
  /** Whether element contains direct text content */
  hasTextContent: boolean;
  /** Whether element is an image */
  isImage: boolean;
  /** Whether element uses display:flex */
  isFlex: boolean;
  /** Whether element uses display:grid */
  isGrid: boolean;
  /** Truncated outerHTML for AI context */
  outerHTML: string;
  /** Number of matching elements (same tag + classes) on the page */
  matchCount: number;
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
  | ImageChange;

export interface BaseChange {
  id: string;
  timestamp: number;
  selector: string;
  /** Human-readable description */
  description: string;
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

/** Exported changeset format for Claude Code / Codex */
export interface Changeset {
  url: string;
  timestamp: string;
  description: string;
  changes: Change[];
}
