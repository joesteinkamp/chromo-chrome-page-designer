/**
 * Selection history — Figma-style undo/redo for element selection state.
 *
 * Each transition from one selected element to another (including to/from
 * nothing) is pushed onto an undo stack. Cmd+Z steps backward through the
 * history, Cmd+Shift+Z steps forward. The surrounding code compares the
 * timestamps from here with change-tracker timestamps to decide whether a
 * given undo invocation should revert an edit or a selection change.
 */

import { generateSelector } from "../shared/selector";

type SelectionEntry = {
  from: string | null;
  fromRef: WeakRef<Element> | null;
  to: string | null;
  toRef: WeakRef<Element> | null;
  timestamp: number;
};

let undoStack: SelectionEntry[] = [];
let redoStack: SelectionEntry[] = [];
let currentSelector: string | null = null;
let currentRef: WeakRef<Element> | null = null;
let suppressRecording = false;

function safeGenerate(el: Element): string | null {
  try {
    return generateSelector(el);
  } catch {
    return null;
  }
}

function resolveEntry(
  selector: string | null,
  ref: WeakRef<Element> | null
): Element | null {
  if (ref) {
    const el = ref.deref();
    if (el && el.isConnected) return el;
  }
  if (selector) {
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Record that the selection transitioned to `element` (null = deselected).
 * No-op when the new selection matches the current one or when recording
 * is temporarily suppressed (e.g. while programmatically restoring from
 * the history stack).
 */
export function recordSelectionChange(element: Element | null): void {
  if (suppressRecording) return;
  const newSelector = element ? safeGenerate(element) : null;
  if (newSelector === currentSelector) return;

  undoStack.push({
    from: currentSelector,
    fromRef: currentRef,
    to: newSelector,
    toRef: element ? new WeakRef(element) : null,
    timestamp: Date.now(),
  });
  redoStack = [];
  currentSelector = newSelector;
  currentRef = element ? new WeakRef(element) : null;
}

/**
 * Pop the last selection transition and return the element we should
 * restore selection to (null means "deselect"). Returns `undefined` when
 * the undo stack is empty so callers can distinguish "nothing to do"
 * from "restore to no-selection".
 */
export function undoSelection(): Element | null | undefined {
  const entry = undoStack.pop();
  if (!entry) return undefined;
  redoStack.push(entry);
  currentSelector = entry.from;
  currentRef = entry.fromRef;
  return resolveEntry(entry.from, entry.fromRef);
}

export function redoSelection(): Element | null | undefined {
  const entry = redoStack.pop();
  if (!entry) return undefined;
  undoStack.push(entry);
  currentSelector = entry.to;
  currentRef = entry.toRef;
  return resolveEntry(entry.to, entry.toRef);
}

/** Timestamp of the most recent entry on the undo stack, or 0. */
export function lastSelectionUndoTimestamp(): number {
  return undoStack.length > 0 ? undoStack[undoStack.length - 1].timestamp : 0;
}

/** Timestamp of the most recent entry on the redo stack, or 0. */
export function lastSelectionRedoTimestamp(): number {
  return redoStack.length > 0 ? redoStack[redoStack.length - 1].timestamp : 0;
}

/**
 * Run `fn` with selection recording disabled. Used while programmatically
 * restoring selection during undo/redo so the restoration itself doesn't
 * get pushed onto the history stack.
 */
export function withSuppressedRecording<T>(fn: () => T): T {
  const prev = suppressRecording;
  suppressRecording = true;
  try {
    return fn();
  } finally {
    suppressRecording = prev;
  }
}

export function clearSelectionHistory(): void {
  undoStack = [];
  redoStack = [];
  currentSelector = null;
  currentRef = null;
}
