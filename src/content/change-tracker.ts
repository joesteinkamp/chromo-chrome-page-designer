/**
 * Change tracker — records all edits made during a session.
 * Provides undo support and serialization for export.
 */

import { generateSelector } from "../shared/selector";
import type { Change, StyleChange, TextChange, MoveChange, ResizeChange, ImageChange } from "../shared/types";

let changes: Change[] = [];
let nextId = 1;
const selectorCache = new WeakMap<Element, string>();

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
  const change: StyleChange = {
    id: makeId(),
    timestamp: Date.now(),
    selector,
    description: `Changed ${property} from "${truncate(from)}" to "${truncate(to)}"`,
    type: "style",
    property,
    from,
    to,
  };
  changes.push(change);
  broadcastChanges();
  return change;
}

export function recordTextChange(
  element: Element,
  from: string,
  to: string
): Change {
  const selector = getSelector(element);
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
  changes.push(change);
  broadcastChanges();
  return change;
}

export function recordResizeChange(
  element: Element,
  from: { width: string; height: string },
  to: { width: string; height: string }
): Change {
  const selector = getSelector(element);
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
  broadcastChanges();
  return change;
}

// --- Undo ---

export function undoChange(changeId: string): boolean {
  const index = changes.findIndex((c) => c.id === changeId);
  if (index === -1) return false;

  const change = changes[index];
  const element = document.querySelector(change.selector);
  if (!element || !(element instanceof HTMLElement)) return false;

  switch (change.type) {
    case "style":
      if (change.from) {
        element.style.setProperty(change.property, change.from, "important");
      } else {
        element.style.removeProperty(change.property);
      }
      break;

    case "text":
      element.textContent = change.from;
      break;

    case "resize":
      element.style.setProperty("width", change.from.width, "important");
      element.style.setProperty("height", change.from.height, "important");
      break;

    case "image":
      if (element.tagName.toLowerCase() === "img") {
        (element as HTMLImageElement).src = change.from;
      } else {
        element.style.setProperty("background-image", `url(${change.from})`, "important");
      }
      break;

    case "move": {
      const origParent = document.querySelector(change.fromParent);
      if (origParent) {
        const children = Array.from(origParent.children);
        const refNode = children[change.fromIndex] || null;
        origParent.insertBefore(element, refNode);
      }
      break;
    }
  }

  changes.splice(index, 1);
  broadcastChanges();
  return true;
}

export function undoAll(): void {
  // Undo in reverse order
  const toUndo = [...changes].reverse();
  for (const change of toUndo) {
    undoChange(change.id);
  }
}

// --- Query ---

export function getChanges(): Change[] {
  return [...changes];
}

export function clearChanges(): void {
  changes = [];
  broadcastChanges();
}

/** Load changes from storage (for persistence replay) */
export function replayChanges(savedChanges: Change[]): { applied: number; failed: number } {
  let applied = 0;
  let failed = 0;

  for (const change of savedChanges) {
    const element = document.querySelector(change.selector);
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
          const newParent = document.querySelector(change.toParent);
          if (newParent) {
            const children = Array.from(newParent.children);
            const refNode = children[change.toIndex] || null;
            newParent.insertBefore(element, refNode);
          }
          break;
        }
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

function truncate(s: string, max = 20): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

function broadcastChanges(): void {
  try {
    chrome.runtime.sendMessage({
      type: "CHANGES_RESPONSE",
      changes: getChanges(),
    });
  } catch {
    // Extension context may be invalidated
  }
}
