/**
 * Keyboard shortcuts for Chromo Design.
 *
 * Esc — deselect element
 * Tab / Shift+Tab — cycle through sibling elements
 * Cmd+Z / Ctrl+Z — undo last change
 * Cmd+Shift+Z / Ctrl+Shift+Z — redo
 * Enter — enter inline edit mode on selected element
 * Arrow keys — nudge position by 1px (Shift = 10px)
 * Delete/Backspace — delete selected element from DOM
 * Cmd+H / Ctrl+H — hide element (display: none)
 * Cmd+G / Cmd+Option+G — wrap element in a group (div)
 * Cmd+D — duplicate selected element
 */

import { isOverlayElement } from "./overlay";
import { isEditing } from "./inline-edit";
import { isDragActive } from "./drag-drop";
import { isResizeActive } from "./resize";
import { generateSelector } from "../shared/selector";
import {
  recordStyleChange,
  recordDeleteChange,
  recordHideChange,
  recordMoveChange,
  undoLast,
  redoLast,
} from "./change-tracker";

interface KeyboardCallbacks {
  getSelectedElement: () => Element | null;
  clearSelection: () => void;
  selectElement: (element: Element) => void;
  startInlineEdit: (element: Element) => void;
  refreshSelection: () => void;
  sendElementData: (element: Element) => void;
  wrapInGroup: (element: HTMLElement) => void;
  duplicateElement: (element: HTMLElement) => void;
}

let callbacks: KeyboardCallbacks | null = null;

export function initKeyboard(cbs: KeyboardCallbacks): void {
  callbacks = cbs;
  document.addEventListener("keydown", onKeyDown, true);
}

export function destroyKeyboard(): void {
  callbacks = null;
  document.removeEventListener("keydown", onKeyDown, true);
}

function onKeyDown(e: KeyboardEvent): void {
  if (!callbacks) return;

  // Don't intercept when in inline edit, drag, or resize mode
  if (isEditing() || isDragActive() || isResizeActive()) return;

  // Don't intercept when user is typing in an input/textarea on the page
  const active = document.activeElement;
  if (
    active &&
    !isOverlayElement(active) &&
    (active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT" ||
      (active as HTMLElement).contentEditable === "true")
  ) {
    return;
  }

  const isMeta = e.metaKey || e.ctrlKey;
  const selected = callbacks.getSelectedElement();

  // Esc — deselect
  if (e.key === "Escape") {
    if (selected) {
      e.preventDefault();
      e.stopPropagation();
      callbacks.clearSelection();
    }
    return;
  }

  // Cmd+Z / Ctrl+Z — undo
  if (isMeta && !e.shiftKey && e.key === "z") {
    e.preventDefault();
    e.stopPropagation();
    if (undoLast()) {
      callbacks.refreshSelection();
      if (selected) callbacks.sendElementData(selected);
    }
    return;
  }

  // Cmd+Shift+Z / Ctrl+Shift+Z — redo
  if (isMeta && e.shiftKey && (e.key === "z" || e.key === "Z")) {
    e.preventDefault();
    e.stopPropagation();
    if (redoLast()) {
      callbacks.refreshSelection();
      if (selected) callbacks.sendElementData(selected);
    }
    return;
  }

  // Cmd+G / Cmd+Option+G — wrap in group
  if (isMeta && (e.key === "g" || e.key === "G")) {
    if (selected && selected instanceof HTMLElement) {
      e.preventDefault();
      e.stopPropagation();
      callbacks.wrapInGroup(selected);
    }
    return;
  }

  // Cmd+D / Ctrl+D — duplicate element
  if (isMeta && (e.key === "d" || e.key === "D")) {
    if (selected && selected instanceof HTMLElement) {
      e.preventDefault();
      e.stopPropagation();
      callbacks.duplicateElement(selected);
    }
    return;
  }

  // Cmd+H / Ctrl+H — hide element
  if (isMeta && (e.key === "h" || e.key === "H")) {
    if (selected && selected instanceof HTMLElement) {
      e.preventDefault();
      e.stopPropagation();
      const computed = window.getComputedStyle(selected);
      const prevDisplay = computed.display;
      selected.style.setProperty("display", "none", "important");
      recordHideChange(selected, prevDisplay);
      callbacks.clearSelection();
    }
    return;
  }

  // The rest require a selected element
  if (!selected || !(selected instanceof HTMLElement)) return;

  // Tab / Shift+Tab — cycle siblings
  if (e.key === "Tab") {
    e.preventDefault();
    e.stopPropagation();
    const parent = selected.parentElement;
    if (!parent) return;
    const siblings = Array.from(parent.children).filter(
      (c) => !isOverlayElement(c) && c !== document.body && c !== document.documentElement
    );
    const currentIndex = siblings.indexOf(selected);
    if (currentIndex === -1) return;
    const nextIndex = e.shiftKey
      ? (currentIndex - 1 + siblings.length) % siblings.length
      : (currentIndex + 1) % siblings.length;
    callbacks.selectElement(siblings[nextIndex]);
    return;
  }

  // Enter — inline edit
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    callbacks.startInlineEdit(selected);
    return;
  }

  // Delete / Backspace — delete element
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    e.stopPropagation();
    const parent = selected.parentElement;
    if (!parent) return;
    const parentSelector = generateSelector(parent);
    const index = Array.from(parent.children).indexOf(selected);
    recordDeleteChange(selected, parentSelector, index);
    selected.remove();
    callbacks.clearSelection();
    return;
  }

  // Arrow keys — reorder within auto-layout (flex/grid) or nudge position
  if (
    e.key === "ArrowUp" ||
    e.key === "ArrowDown" ||
    e.key === "ArrowLeft" ||
    e.key === "ArrowRight"
  ) {
    e.preventDefault();
    e.stopPropagation();

    const parent = selected.parentElement;
    if (!parent) return;

    const parentDisplay = window.getComputedStyle(parent).display;
    const isAutoLayout =
      parentDisplay === "flex" ||
      parentDisplay === "inline-flex" ||
      parentDisplay === "grid" ||
      parentDisplay === "inline-grid";

    if (isAutoLayout) {
      // Reorder element within the flex/grid container
      const siblings = Array.from(parent.children).filter(
        (c) => !isOverlayElement(c)
      );
      const currentIndex = siblings.indexOf(selected);
      if (currentIndex === -1) return;

      // Determine direction based on flex-direction / grid flow
      const parentComputed = window.getComputedStyle(parent);
      const flexDir = parentComputed.flexDirection || "row";
      const isVertical = flexDir === "column" || flexDir === "column-reverse";
      const isReversed = flexDir === "row-reverse" || flexDir === "column-reverse";

      let moveForward: boolean;
      if (isVertical) {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        moveForward = isReversed
          ? e.key === "ArrowUp"
          : e.key === "ArrowDown";
      } else {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        moveForward = isReversed
          ? e.key === "ArrowLeft"
          : e.key === "ArrowRight";
      }

      const fromParent = generateSelector(parent);
      const fromIndex = currentIndex;

      if (moveForward && currentIndex < siblings.length - 1) {
        // Move after the next sibling
        const nextSibling = siblings[currentIndex + 1];
        parent.insertBefore(nextSibling, selected);
        recordMoveChange(selected, fromParent, fromIndex, fromParent, fromIndex + 1);
      } else if (!moveForward && currentIndex > 0) {
        // Move before the previous sibling
        const prevSibling = siblings[currentIndex - 1];
        parent.insertBefore(selected, prevSibling);
        recordMoveChange(selected, fromParent, fromIndex, fromParent, fromIndex - 1);
      } else {
        return; // Already at the edge
      }

      callbacks.refreshSelection();
      callbacks.sendElementData(selected);
      return;
    }

    // Not in auto-layout — nudge position by pixels
    const amount = e.shiftKey ? 10 : 1;
    const computed = window.getComputedStyle(selected);

    // Ensure element is positioned for movement
    const position = computed.position;
    if (position === "static") {
      selected.style.setProperty("position", "relative", "important");
      recordStyleChange(selected, "position", "static", "relative");
    }

    let prop: string;
    let delta: number;

    switch (e.key) {
      case "ArrowUp":
        prop = "top";
        delta = -amount;
        break;
      case "ArrowDown":
        prop = "top";
        delta = amount;
        break;
      case "ArrowLeft":
        prop = "left";
        delta = -amount;
        break;
      case "ArrowRight":
        prop = "left";
        delta = amount;
        break;
      default:
        return;
    }

    const current = parseFloat(computed.getPropertyValue(prop)) || 0;
    const oldValue = `${current}px`;
    const newValue = `${current + delta}px`;
    selected.style.setProperty(prop, newValue, "important");
    recordStyleChange(selected, prop, oldValue, newValue);
    callbacks.refreshSelection();
    callbacks.sendElementData(selected);
    return;
  }
}
