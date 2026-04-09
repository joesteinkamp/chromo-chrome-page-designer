/**
 * Change tracker — records all edits made during a session.
 * Provides undo/redo support and serialization for export.
 */

import { generateSelector, IFRAME_SELECTOR_SEP } from "../shared/selector";
import type {
  Change,
  StyleChange,
  TextChange,
  MoveChange,
  ResizeChange,
  ImageChange,
  DeleteChange,
  HideChange,
  WrapChange,
  DuplicateChange,
} from "../shared/types";

let changes: Change[] = [];
let redoStack: Change[] = [];
let nextId = 1;
let currentBatchId: string | null = null;
const selectorCache = new WeakMap<Element, string>();
/** Direct element references for move changes — selectors are unreliable after DOM reorder */
const moveElementRefs = new Map<string, Element>();

/** Start a batch — all changes recorded until endBatch share a batchId */
export function startBatch(): string {
  currentBatchId = `batch_${nextId++}_${Date.now()}`;
  return currentBatchId;
}

/** End the current batch */
export function endBatch(): void {
  currentBatchId = null;
}

/** Get or compute a cached CSS selector for an element */
function getSelector(element: Element): string {
  let sel = selectorCache.get(element);
  if (!sel) {
    sel = generateSelector(element);
    selectorCache.set(element, sel);
  }
  return sel;
}

function makeId(): string {
  return `ch_${nextId++}_${Date.now()}`;
}

// --- Record changes ---

export function recordStyleChange(
  element: Element,
  property: string,
  from: string,
  to: string
): Change {
  const selector = getSelector(element);

  // Coalesce: if the last change is for the same element+property, update it
  const existing = findExisting(selector, "style", property);
  if (existing && existing.type === "style") {
    existing.to = to;
    existing.timestamp = Date.now();
    existing.description = `Changed ${property} from "${truncate(existing.from)}" to "${truncate(to)}"`;
    // If we've gone back to the original value, remove the change entirely
    if (existing.from === to) {
      changes.splice(changes.indexOf(existing), 1);
    }
    broadcastChanges();
    return existing;
  }

  const change: StyleChange = {
    id: makeId(),
    timestamp: Date.now(),
    selector,
    description: `Changed ${property} from "${truncate(from)}" to "${truncate(to)}"`,
    type: "style",
    property,
    from,
    to,
    ...(currentBatchId ? { batchId: currentBatchId } : {}),
  };
  changes.push(change);
  redoStack = [];
  broadcastChanges();
  return change;
}

export function recordTextChange(
  element: Element,
  from: string,
  to: string
): Change {
  const selector = getSelector(element);

  // Coalesce: if there's already a text change for this element, update it
  const existing = findExisting(selector, "text");
  if (existing && existing.type === "text") {
    existing.to = to;
    existing.timestamp = Date.now();
    existing.description = `Changed text from "${truncate(existing.from, 30)}" to "${truncate(to, 30)}"`;
    if (existing.from === to) {
      changes.splice(changes.indexOf(existing), 1);
    }
    broadcastChanges();
    return existing;
  }

  const change: TextChange = {
    id: makeId(),
    timestamp: Date.now(),
    selector,
    description: `Changed text from "${truncate(from, 30)}" to "${truncate(to, 30)}"`,
    type: "text",
    from,
    to,
  };
  changes.push(change);
  redoStack = [];
  broadcastChanges();
  return change;
}

export function recordMoveChange(
  element: Element,
  fromParent: string,
  fromIndex: number,
  toParent: string,
  toIndex: number
): Change {
  // Invalidate cached selector — element has moved so position-based selectors are stale
  selectorCache.delete(element);
  const selector = getSelector(element);
  const change: MoveChange = {
    id: makeId(),
    timestamp: Date.now(),
    selector,
    description: `Moved element from position ${fromIndex} to ${toIndex}`,
    type: "move",
    fromParent,
    fromIndex,
    toParent,
    toIndex,
  };
  // Store direct element reference so undo/redo can find it regardless of selector validity
  moveElementRefs.set(change.id, element);
  changes.push(change);
  redoStack = [];
  broadcastChanges();
  return change;
}

export function recordResizeChange(
  element: Element,
  from: { width: string; height: string },
  to: { width: string; height: string }
): Change {
  const selector = getSelector(element);

  // Coalesce: update existing resize for same element
  const existing = findExisting(selector, "resize");
  if (existing && existing.type === "resize") {
    existing.to = to;
    existing.timestamp = Date.now();
    existing.description = `Resized from ${existing.from.width}×${existing.from.height} to ${to.width}×${to.height}`;
    if (existing.from.width === to.width && existing.from.height === to.height) {
      changes.splice(changes.indexOf(existing), 1);
    }
    broadcastChanges();
    return existing;
  }

  const change: ResizeChange = {
    id: makeId(),
    timestamp: Date.now(),
    selector,
    description: `Resized from ${from.width}×${from.height} to ${to.width}×${to.height}`,
    type: "resize",
    from,
    to,
  };
  changes.push(change);
  redoStack = [];
  broadcastChanges();
  return change;
}

export function recordImageChange(
  element: Element,
  from: string,
  to: string
): Change {
  const selector = getSelector(element);
  const change: ImageChange = {
    id: makeId(),
    timestamp: Date.now(),
    selector,
    description: `Replaced image source`,
    type: "image",
    from,
    to,
  };
  changes.push(change);
  redoStack = [];
  broadcastChanges();
  return change;
}

export function recordDeleteChange(
  element: Element,
  parentSelector: string,
  index: number
): Change {
  const selector = getSelector(element);
  const change: DeleteChange = {
    id: makeId(),
    timestamp: Date.now(),
    selector,
    description: `Deleted ${element.tagName.toLowerCase()} element`,
    type: "delete",
    html: element.outerHTML,
    parentSelector,
    index,
  };
  changes.push(change);
  redoStack = [];
  broadcastChanges();
  return change;
}

export function recordHideChange(
  element: Element,
  previousDisplay: string
): Change {
  const selector = getSelector(element);
  const change: HideChange = {
    id: makeId(),
    timestamp: Date.now(),
    selector,
    description: `Hidden ${element.tagName.toLowerCase()} element`,
    type: "hide",
    previousDisplay,
  };
  changes.push(change);
  redoStack = [];
  broadcastChanges();
  return change;
}

export function recordWrapChange(
  element: Element,
  wrapper: Element
): Change {
  const selector = getSelector(element);
  const wrapperSelector = getSelector(wrapper);
  const change: WrapChange = {
    id: makeId(),
    timestamp: Date.now(),
    selector,
    description: `Wrapped ${element.tagName.toLowerCase()} in a group`,
    type: "wrap",
    wrapperSelector,
  };
  changes.push(change);
  redoStack = [];
  broadcastChanges();
  return change;
}

export function recordDuplicateChange(
  original: Element,
  clone: Element
): Change {
  const selector = getSelector(original);
  const cloneSelector = getSelector(clone);
  const change: DuplicateChange = {
    id: makeId(),
    timestamp: Date.now(),
    selector,
    description: `Duplicated ${original.tagName.toLowerCase()} element`,
    type: "duplicate",
    cloneSelector,
  };
  changes.push(change);
  redoStack = [];
  broadcastChanges();
  return change;
}

// --- Undo ---

export function undoChange(changeId: string): boolean {
  const index = changes.findIndex((c) => c.id === changeId);
  if (index === -1) return false;

  const change = changes[index];
  const applied = applyUndo(change);
  if (!applied) return false;

  changes.splice(index, 1);
  redoStack.push(change);
  broadcastChanges();
  return true;
}

/** Undo the most recent change (or entire batch if batched) */
export function undoLast(): boolean {
  if (changes.length === 0) return false;
  const last = changes[changes.length - 1];

  // If the last change has a batchId, undo all changes in that batch
  if (last.batchId) {
    const batchId = last.batchId;
    const batchChanges = changes.filter((c) => c.batchId === batchId);
    let success = false;
    for (const c of [...batchChanges].reverse()) {
      if (undoChange(c.id)) success = true;
    }
    return success;
  }

  return undoChange(last.id);
}

export function undoAll(): void {
  const toUndo = [...changes].reverse();
  for (const change of toUndo) {
    undoChange(change.id);
  }
}

// --- Redo ---

export function redoLast(): boolean {
  if (redoStack.length === 0) return false;
  const change = redoStack.pop()!;
  const applied = applyRedo(change);
  if (!applied) return false;

  changes.push(change);
  broadcastChanges();
  return true;
}

function applyUndo(change: Change): boolean {
  const element = resolveSelector(change.selector);

  switch (change.type) {
    case "style":
      if (!element || !(element instanceof HTMLElement)) return false;
      if (change.from) {
        element.style.setProperty(change.property, change.from, "important");
      } else {
        element.style.removeProperty(change.property);
      }
      return true;

    case "text":
      if (!element || !(element instanceof HTMLElement)) return false;
      element.textContent = change.from;
      return true;

    case "resize":
      if (!element || !(element instanceof HTMLElement)) return false;
      element.style.setProperty("width", change.from.width, "important");
      element.style.setProperty("height", change.from.height, "important");
      return true;

    case "image":
      if (!element || !(element instanceof HTMLElement)) return false;
      if (element.tagName.toLowerCase() === "img") {
        (element as HTMLImageElement).src = change.from;
      } else {
        element.style.setProperty(
          "background-image",
          `url(${change.from})`,
          "important"
        );
      }
      return true;

    case "move": {
      const moveEl = moveElementRefs.get(change.id) ?? element;
      if (!moveEl) return false;
      const origParent = resolveSelector(change.fromParent);
      if (origParent) {
        const children = Array.from(origParent.children);
        const refNode = children[change.fromIndex] || null;
        origParent.insertBefore(moveEl, refNode);
        // Update selector to reflect restored position
        selectorCache.delete(moveEl);
        change.selector = generateSelector(moveEl);
        selectorCache.set(moveEl, change.selector);
      }
      return true;
    }

    case "delete": {
      // Restore deleted element
      const parent = resolveSelector(change.parentSelector);
      if (!parent) return false;
      const temp = document.createElement("div");
      temp.innerHTML = change.html;
      const restored = temp.firstElementChild;
      if (!restored) return false;
      const children = Array.from(parent.children);
      const refNode = children[change.index] || null;
      parent.insertBefore(restored, refNode);
      return true;
    }

    case "hide": {
      if (!element || !(element instanceof HTMLElement)) return false;
      if (change.previousDisplay && change.previousDisplay !== "none") {
        element.style.setProperty("display", change.previousDisplay, "important");
      } else {
        element.style.removeProperty("display");
      }
      return true;
    }

    case "wrap": {
      // Undo: unwrap the element from its wrapper
      const wrapper = resolveSelector(change.wrapperSelector);
      if (!wrapper) return false;
      const parent = wrapper.parentElement;
      if (!parent) return false;
      while (wrapper.firstChild) {
        parent.insertBefore(wrapper.firstChild, wrapper);
      }
      wrapper.remove();
      return true;
    }

    case "duplicate": {
      // Undo: remove the cloned element
      const clone = resolveSelector(change.cloneSelector);
      if (clone) clone.remove();
      return true;
    }
  }
}

function applyRedo(change: Change): boolean {
  const element = resolveSelector(change.selector);

  switch (change.type) {
    case "style":
      if (!element || !(element instanceof HTMLElement)) return false;
      element.style.setProperty(change.property, change.to, "important");
      return true;

    case "text":
      if (!element || !(element instanceof HTMLElement)) return false;
      element.textContent = change.to;
      return true;

    case "resize":
      if (!element || !(element instanceof HTMLElement)) return false;
      element.style.setProperty("width", change.to.width, "important");
      element.style.setProperty("height", change.to.height, "important");
      return true;

    case "image":
      if (!element || !(element instanceof HTMLElement)) return false;
      if (element.tagName.toLowerCase() === "img") {
        (element as HTMLImageElement).src = change.to;
      } else {
        element.style.setProperty(
          "background-image",
          `url(${change.to})`,
          "important"
        );
      }
      return true;

    case "move": {
      const moveEl = moveElementRefs.get(change.id) ?? element;
      if (!moveEl) return false;
      const newParent = resolveSelector(change.toParent);
      if (newParent) {
        const children = Array.from(newParent.children);
        const refNode = children[change.toIndex] || null;
        newParent.insertBefore(moveEl, refNode);
        // Update selector to reflect new position
        selectorCache.delete(moveEl);
        change.selector = generateSelector(moveEl);
        selectorCache.set(moveEl, change.selector);
      }
      return true;
    }

    case "delete": {
      const el = resolveSelector(change.selector);
      if (el) el.remove();
      return true;
    }

    case "hide": {
      if (!element || !(element instanceof HTMLElement)) return false;
      element.style.setProperty("display", "none", "important");
      return true;
    }

    case "wrap": {
      // Redo: re-wrap the element
      if (!element) return false;
      const parent = element.parentElement;
      if (!parent) return false;
      const wrapper = document.createElement("div");
      wrapper.classList.add("__pd-group");
      parent.insertBefore(wrapper, element);
      wrapper.appendChild(element);
      return true;
    }

    case "duplicate": {
      // Redo: re-clone the element after itself
      if (!element) return false;
      const clone = element.cloneNode(true) as Element;
      element.after(clone);
      return true;
    }
  }
}

/** Alias for redoLast — kept for backward compatibility */
export const redoChange = redoLast;

// --- Query ---

export function getChanges(): Change[] {
  return [...changes];
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

export function clearChanges(): void {
  changes = [];
  redoStack = [];
  moveElementRefs.clear();
  broadcastChanges();
}

/** Load changes from storage (for persistence replay) */
export function replayChanges(
  savedChanges: Change[]
): { applied: number; failed: number } {
  let applied = 0;
  let failed = 0;

  for (const change of savedChanges) {
    const element = resolveSelector(change.selector);
    if (!element || !(element instanceof HTMLElement)) {
      failed++;
      continue;
    }

    try {
      switch (change.type) {
        case "style":
          element.style.setProperty(change.property, change.to, "important");
          break;
        case "text":
          element.textContent = change.to;
          break;
        case "resize":
          element.style.setProperty("width", change.to.width, "important");
          element.style.setProperty("height", change.to.height, "important");
          break;
        case "image":
          if (element.tagName.toLowerCase() === "img") {
            (element as HTMLImageElement).src = change.to;
          }
          break;
        case "move": {
          const newParent = resolveSelector(change.toParent);
          if (newParent) {
            const children = Array.from(newParent.children);
            const refNode = children[change.toIndex] || null;
            newParent.insertBefore(element, refNode);
          }
          break;
        }
        case "hide":
          element.style.setProperty("display", "none", "important");
          break;
      }
      // Re-record in local state
      changes.push({ ...change, id: makeId(), timestamp: Date.now() });
      applied++;
    } catch {
      failed++;
    }
  }

  if (applied > 0) broadcastChanges();
  return { applied, failed };
}

// --- Helpers ---

/**
 * Find an existing change for the same element+type+property.
 * Used to coalesce repeated edits (e.g. adjusting border-radius with a slider)
 * into a single change that records original → final value.
 */
function findExisting(
  selector: string,
  type: Change["type"],
  property?: string
): Change | undefined {
  for (let i = changes.length - 1; i >= 0; i--) {
    const c = changes[i];
    if (c.selector === selector && c.type === type) {
      if (type === "style" && property) {
        if (c.type === "style" && c.property === property) return c;
      } else {
        return c;
      }
    }
  }
  return undefined;
}

/**
 * Resolve a selector that may include an iframe prefix (>>>).
 * When running inside an iframe, strips the iframe path and queries locally.
 * When running in the top frame, tries to traverse into iframes if needed.
 */
function resolveSelector(selector: string): Element | null {
  if (!selector.includes(IFRAME_SELECTOR_SEP)) {
    return document.querySelector(selector);
  }

  const parts = selector.split(IFRAME_SELECTOR_SEP);
  const localSelector = parts.pop()!;

  // If we're inside an iframe, just use the local part
  if (window !== window.top) {
    return document.querySelector(localSelector);
  }

  // In the top frame, traverse through iframes
  let currentDoc: Document = document;
  for (const iframeSel of parts) {
    const iframe = currentDoc.querySelector(iframeSel) as HTMLIFrameElement | null;
    if (!iframe) return null;
    try {
      currentDoc = iframe.contentDocument!;
      if (!currentDoc) return null;
    } catch {
      // Cross-origin iframe — can't access
      return null;
    }
  }
  return currentDoc.querySelector(localSelector);
}

function truncate(s: string, max = 20): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\u2026";
}

function broadcastChanges(): void {
  try {
    if (!chrome.runtime?.id) return;
    chrome.runtime.sendMessage({
      type: "CHANGES_RESPONSE",
      changes: getChanges(),
      canRedo: canRedo(),
    }).catch(() => {});
  } catch {
    // Extension context may be invalidated
  }
}
