/**
 * Selection history — Figma-style undo/redo for element selection state.
 *
 * Each transition between selection states is pushed onto an undo stack.
 * A "selection state" can represent no selection, a single selected element,
 * or multiple selected elements with a designated primary. Cmd+Z steps
 * backward through the history, Cmd+Shift+Z steps forward. The surrounding
 * code compares the timestamps from here with change-tracker timestamps to
 * decide whether a given undo invocation should revert an edit or a
 * selection change.
 */

import { generateSelector } from "../shared/selector";

type ElementRef = {
  selector: string | null;
  ref: WeakRef<Element> | null;
};

type SelectionState = {
  primary: ElementRef | null;
  /** Non-primary multi-selected elements. Empty for single/no selection. */
  extras: ElementRef[];
};

export type RestoredSelection =
  | { kind: "none" }
  | { kind: "single"; element: Element }
  | { kind: "multi"; primary: Element; elements: Element[] };

type SelectionEntry = {
  from: SelectionState;
  to: SelectionState;
  timestamp: number;
};

const EMPTY_STATE: SelectionState = { primary: null, extras: [] };

let undoStack: SelectionEntry[] = [];
let redoStack: SelectionEntry[] = [];
let currentState: SelectionState = EMPTY_STATE;
let suppressRecording = false;

function safeGenerate(el: Element): string | null {
  try {
    return generateSelector(el);
  } catch {
    return null;
  }
}

function makeRef(el: Element): ElementRef {
  return { selector: safeGenerate(el), ref: new WeakRef(el) };
}

function makeState(
  primary: Element | null,
  extras: Element[] = []
): SelectionState {
  return {
    primary: primary ? makeRef(primary) : null,
    extras: extras.map(makeRef),
  };
}

function statesEqual(a: SelectionState, b: SelectionState): boolean {
  const aSel = a.primary?.selector ?? null;
  const bSel = b.primary?.selector ?? null;
  if (aSel !== bSel) return false;
  if (a.extras.length !== b.extras.length) return false;
  for (let i = 0; i < a.extras.length; i++) {
    if (a.extras[i].selector !== b.extras[i].selector) return false;
  }
  return true;
}

function resolveRef(r: ElementRef | null): Element | null {
  if (!r) return null;
  if (r.ref) {
    const el = r.ref.deref();
    if (el && el.isConnected) return el;
  }
  if (r.selector) {
    try {
      return document.querySelector(r.selector);
    } catch {
      return null;
    }
  }
  return null;
}

function resolveState(s: SelectionState): RestoredSelection {
  const primary = resolveRef(s.primary);
  if (!primary) return { kind: "none" };
  if (s.extras.length === 0) return { kind: "single", element: primary };
  const extras = s.extras
    .map(resolveRef)
    .filter((el): el is Element => !!el);
  if (extras.length === 0) return { kind: "single", element: primary };
  return { kind: "multi", primary, elements: [primary, ...extras] };
}

function pushTransition(next: SelectionState): void {
  if (suppressRecording) return;
  if (statesEqual(currentState, next)) return;
  undoStack.push({
    from: currentState,
    to: next,
    timestamp: Date.now(),
  });
  redoStack = [];
  currentState = next;
}

/**
 * Record that the selection transitioned to a single element (or to nothing
 * when `element` is null). No-op when the new state matches the current one
 * or when recording is temporarily suppressed.
 */
export function recordSelectionChange(element: Element | null): void {
  pushTransition(makeState(element));
}

/**
 * Record a multi-selection transition. `elements` is the full multi-select
 * set (which includes `primary`); `primary` is the element whose properties
 * are shown in the panel.
 */
export function recordMultiSelectionChange(
  elements: Element[],
  primary: Element
): void {
  const extras = elements.filter((el) => el !== primary);
  pushTransition(makeState(primary, extras));
}

/**
 * Pop the last selection transition and return the state to restore. Returns
 * `undefined` when the undo stack is empty so callers can distinguish
 * "nothing to do" from "restore to no-selection".
 */
export function undoSelection(): RestoredSelection | undefined {
  const entry = undoStack.pop();
  if (!entry) return undefined;
  redoStack.push(entry);
  currentState = entry.from;
  return resolveState(entry.from);
}

export function redoSelection(): RestoredSelection | undefined {
  const entry = redoStack.pop();
  if (!entry) return undefined;
  undoStack.push(entry);
  currentState = entry.to;
  return resolveState(entry.to);
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
  currentState = EMPTY_STATE;
}
