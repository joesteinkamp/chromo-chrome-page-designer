/**
 * In-page clipboard for elements and styles (Figma-style Cmd+C/V and Cmd+Alt+C/V).
 *
 * Element copy keeps a live reference; paste clones it after the target and
 * records a duplicate change, so undo/redo behaves exactly like Cmd+D.
 * Style copy snapshots paint/text/effect properties — deliberately not layout
 * (width/position/margins) — so pasting a style restyles the target without
 * moving or resizing it.
 */

import { applyStyleToElement } from "./style-bridge";
import {
  recordStyleChange,
  recordDuplicateChange,
  startBatch,
  endBatch,
} from "./change-tracker";

/** Visual properties carried by the style clipboard. */
const STYLE_CLIPBOARD_PROPS = [
  "background-color",
  "background-image",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "text-decoration-line",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "box-shadow",
  "opacity",
  "filter",
  "backdrop-filter",
] as const;

let copiedElement: HTMLElement | null = null;
let copiedStyles: Record<string, string> | null = null;

export function copyElement(element: HTMLElement): void {
  copiedElement = element;
}

export function hasCopiedElement(): boolean {
  return copiedElement !== null && copiedElement.isConnected;
}

/** Tags that can never receive pasted children (void or replaced elements). */
const NON_CONTAINER_TAGS = new Set([
  "IMG",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "BUTTON",
  "BR",
  "HR",
  "VIDEO",
  "AUDIO",
  "IFRAME",
  "CANVAS",
  "SVG",
  "EMBED",
  "OBJECT",
]);

/**
 * Figma pastes into the selected frame — mirror that: a selection with
 * element children (or an empty non-void element) receives the paste as its
 * last child; a leaf with text content gets it as the next sibling instead.
 */
function isPasteContainer(el: HTMLElement): boolean {
  if (NON_CONTAINER_TAGS.has(el.tagName)) return false;
  if (el.children.length > 0) return true;
  return !(el.textContent && el.textContent.trim());
}

/**
 * Paste a clone of the copied element — into the target when it's a
 * container, after it otherwise. Requires the source to still be in the DOM
 * (the clipboard holds a live reference).
 */
export function pasteElement(target: HTMLElement): HTMLElement | null {
  if (!copiedElement || !copiedElement.isConnected) return null;
  const clone = copiedElement.cloneNode(true) as HTMLElement;
  if (isPasteContainer(target)) {
    target.appendChild(clone);
    recordDuplicateChange(copiedElement, clone, target, "append");
  } else {
    target.after(clone);
    recordDuplicateChange(copiedElement, clone, target, "after");
  }
  return clone;
}

export function copyStyles(element: HTMLElement): void {
  const computed = window.getComputedStyle(element);
  const snapshot: Record<string, string> = {};
  for (const prop of STYLE_CLIPBOARD_PROPS) {
    snapshot[prop] = computed.getPropertyValue(prop);
  }
  copiedStyles = snapshot;
}

export function hasCopiedStyles(): boolean {
  return copiedStyles !== null;
}

/** Apply the copied style snapshot to the target as one undoable batch. */
export function pasteStyles(element: HTMLElement): boolean {
  if (!copiedStyles) return false;

  // Snapshot the target's current values before mutating — getComputedStyle
  // is live, and applying one property could shift another's computed value.
  const computed = window.getComputedStyle(element);
  const current: Record<string, string> = {};
  for (const prop of Object.keys(copiedStyles)) {
    current[prop] = computed.getPropertyValue(prop);
  }

  startBatch();
  for (const [prop, value] of Object.entries(copiedStyles)) {
    if (current[prop] === value) continue;
    applyStyleToElement(element, prop, value);
    recordStyleChange(element, prop, current[prop], value);
  }
  endBatch();
  return true;
}
