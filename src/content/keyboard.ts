/**
 * Keyboard shortcuts for Chromo Design.
 *
 * Esc — deselect element
 * Tab / Shift+Tab — cycle through sibling elements
 * Cmd+Z / Ctrl+Z — undo last action (edit OR selection change, Figma-style)
 * Cmd+Shift+Z / Ctrl+Shift+Z — redo last undone action
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
import { isPopoverOpen, isInsidePopover } from "./comment-popover";
import { generateSelector } from "../shared/selector";
import { getMode, setMode, canReorderElement } from "./move-mode";
import {
  recordStyleChange,
  recordDeleteChange,
  recordHideChange,
  recordMoveChange,
  undoLast,
  redoLast,
  lastChangeTimestamp,
  lastRedoChangeTimestamp,
} from "./change-tracker";
import {
  undoSelection,
  redoSelection,
  lastSelectionUndoTimestamp,
  lastSelectionRedoTimestamp,
  withSuppressedRecording,
} from "./selection-history";

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

  // Don't intercept while the comment popover is open — its own handlers
  // manage Esc/Enter and the user is typing free-form text.
  if (isPopoverOpen() && isInsidePopover(document.activeElement)) return;

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

  // Cmd+Z / Ctrl+Z — undo. Figma-style: the history is a single interleaved
  // timeline of edits and selection changes, so we undo whichever action
  // happened most recently.
  if (isMeta && !e.shiftKey && e.key === "z") {
    e.preventDefault();
    e.stopPropagation();

    const changeTs = lastChangeTimestamp();
    const selectionTs = lastSelectionUndoTimestamp();

    if (selectionTs > 0 && selectionTs >= changeTs) {
      // Restore previous selection. Suppress recording so the restoration
      // itself doesn't push a fresh entry onto the history stack.
      withSuppressedRecording(() => {
        const restored = undoSelection();
        if (restored === undefined) return;
        if (restored === null) {
          callbacks!.clearSelection();
        } else {
          callbacks!.selectElement(restored);
        }
      });
    } else if (changeTs > 0) {
      if (undoLast()) {
        callbacks.refreshSelection();
        const after = callbacks.getSelectedElement();
        if (after) callbacks.sendElementData(after);
      }
    }
    return;
  }

  // Cmd+Shift+Z / Ctrl+Shift+Z — redo (mirrors the undo decision).
  if (isMeta && e.shiftKey && (e.key === "z" || e.key === "Z")) {
    e.preventDefault();
    e.stopPropagation();

    const changeRedoTs = lastRedoChangeTimestamp();
    const selectionRedoTs = lastSelectionRedoTimestamp();

    if (selectionRedoTs > 0 && selectionRedoTs >= changeRedoTs) {
      withSuppressedRecording(() => {
        const restored = redoSelection();
        if (restored === undefined) return;
        if (restored === null) {
          callbacks!.clearSelection();
        } else {
          callbacks!.selectElement(restored);
        }
      });
    } else if (changeRedoTs > 0) {
      if (redoLast()) {
        callbacks.refreshSelection();
        const after = callbacks.getSelectedElement();
        if (after) callbacks.sendElementData(after);
      }
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

  // P — switch to position mode
  if ((e.key === "p" || e.key === "P") && !isMeta) {
    e.preventDefault();
    e.stopPropagation();
    setMode("position");
    return;
  }

  // R — switch to reorder mode (works for any element with a parent,
  // including non-flex/grid siblings like two block-level <div>s)
  if ((e.key === "r" || e.key === "R") && !isMeta) {
    if (canReorderElement(selected)) {
      e.preventDefault();
      e.stopPropagation();
      setMode("reorder");
    }
    return;
  }

  // Arrow keys — move based on current mode
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

    if (getMode() === "reorder") {
      // Reorder element among its DOM siblings. Works for any parent —
      // flex/grid containers, regular block flow, etc.
      const siblings = Array.from(parent.children).filter(
        (c) => !isOverlayElement(c)
      );
      const currentIndex = siblings.indexOf(selected);
      if (currentIndex === -1) return;

      // Map all arrows to forward/backward: Right/Down = forward, Left/Up = backward.
      // For flex containers, respect flex-direction reverse variants. For other
      // layouts, flex-direction defaults to "row" so this is a no-op.
      const parentComputed = window.getComputedStyle(parent);
      const flexDir = parentComputed.flexDirection || "row";
      const isReversed = flexDir === "row-reverse" || flexDir === "column-reverse";

      const forwardKey = e.key === "ArrowRight" || e.key === "ArrowDown";
      const moveForward = isReversed ? !forwardKey : forwardKey;

      const fromParent = generateSelector(parent);
      const fromIndex = currentIndex;

      if (moveForward && currentIndex < siblings.length - 1) {
        const nextSibling = siblings[currentIndex + 1];
        parent.insertBefore(nextSibling, selected);
        recordMoveChange(selected, fromParent, fromIndex, fromParent, fromIndex + 1);
      } else if (!moveForward && currentIndex > 0) {
        const prevSibling = siblings[currentIndex - 1];
        parent.insertBefore(selected, prevSibling);
        recordMoveChange(selected, fromParent, fromIndex, fromParent, fromIndex - 1);
      } else {
        return;
      }

      callbacks.refreshSelection();
      callbacks.sendElementData(selected);
      return;
    }

    // Position mode — nudge by pixels
    const amount = e.shiftKey ? 10 : 1;
    const computed = window.getComputedStyle(selected);

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
