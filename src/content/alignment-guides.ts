/**
 * Figma-style smart alignment guides for position-mode dragging.
 * While an element is dragged, its edges and centers are compared against
 * sibling and parent edges/centers; within the snap threshold the drag
 * sticks to the aligned position and a red guide line is drawn through
 * both elements. Hold Alt to disable snapping.
 */

const SNAP_THRESHOLD = 5;
const GUIDE_COLOR = "#ff3366";

export interface SnapRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
}

export interface SnapResult {
  /** Adjustment to add to the proposed x position (0 when no snap) */
  dx: number;
  /** Adjustment to add to the proposed y position (0 when no snap) */
  dy: number;
}

let vGuide: HTMLDivElement | null = null;
let hGuide: HTMLDivElement | null = null;

function toSnapRect(r: { left: number; top: number; right: number; bottom: number }): SnapRect {
  return {
    left: r.left,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    cx: (r.left + r.right) / 2,
    cy: (r.top + r.bottom) / 2,
  };
}

/**
 * Collect snap targets for a dragged element: its visible siblings and its
 * parent's bounds. Rects are in viewport coordinates, matching the proposed
 * rect computed from getBoundingClientRect + drag delta.
 */
export function collectSnapTargets(element: Element): SnapRect[] {
  const targets: SnapRect[] = [];
  const parent = element.parentElement;
  if (!parent) return targets;

  const parentRect = parent.getBoundingClientRect();
  if (parentRect.width > 0 && parentRect.height > 0) {
    targets.push(toSnapRect(parentRect));
  }

  for (const sibling of Array.from(parent.children)) {
    if (sibling === element) continue;
    const cls = typeof sibling.className === "string" ? sibling.className : "";
    if (cls.includes("__pd-")) continue;
    const rect = sibling.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    targets.push(toSnapRect(rect));
  }
  return targets;
}

/**
 * Compute the snap adjustment for a proposed rect against the targets and
 * draw guide lines for the winning alignments. Each axis snaps independently
 * to the nearest edge/center alignment within the threshold.
 */
export function applySnap(proposed: SnapRect, targets: SnapRect[]): SnapResult {
  let bestX: { delta: number; lineX: number; target: SnapRect } | null = null;
  let bestY: { delta: number; lineY: number; target: SnapRect } | null = null;

  for (const target of targets) {
    for (const px of [proposed.left, proposed.cx, proposed.right]) {
      for (const tx of [target.left, target.cx, target.right]) {
        const delta = tx - px;
        if (Math.abs(delta) <= SNAP_THRESHOLD && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
          bestX = { delta, lineX: tx, target };
        }
      }
    }
    for (const py of [proposed.top, proposed.cy, proposed.bottom]) {
      for (const ty of [target.top, target.cy, target.bottom]) {
        const delta = ty - py;
        if (Math.abs(delta) <= SNAP_THRESHOLD && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
          bestY = { delta, lineY: ty, target };
        }
      }
    }
  }

  if (bestX) {
    const top = Math.min(proposed.top, bestX.target.top);
    const bottom = Math.max(proposed.bottom, bestX.target.bottom);
    showVerticalGuide(bestX.lineX, top, bottom);
  } else {
    hideEl(vGuide);
  }

  if (bestY) {
    const left = Math.min(proposed.left, bestY.target.left);
    const right = Math.max(proposed.right, bestY.target.right);
    showHorizontalGuide(bestY.lineY, left, right);
  } else {
    hideEl(hGuide);
  }

  return { dx: bestX?.delta ?? 0, dy: bestY?.delta ?? 0 };
}

export function hideGuides(): void {
  hideEl(vGuide);
  hideEl(hGuide);
}

export function destroyGuides(): void {
  vGuide?.remove();
  hGuide?.remove();
  vGuide = null;
  hGuide = null;
}

// --- Internal ---

function ensureGuide(existing: HTMLDivElement | null): HTMLDivElement {
  if (existing && existing.isConnected) return existing;
  const guide = document.createElement("div");
  guide.className = "__pd-align-guide";
  guide.style.cssText = `
    position: fixed !important;
    z-index: 2147483647 !important;
    background: ${GUIDE_COLOR} !important;
    pointer-events: none !important;
    display: none !important;
  `;
  document.documentElement.appendChild(guide);
  return guide;
}

function showVerticalGuide(x: number, top: number, bottom: number): void {
  vGuide = ensureGuide(vGuide);
  vGuide.style.setProperty("left", `${x}px`, "important");
  vGuide.style.setProperty("top", `${top - 4}px`, "important");
  vGuide.style.setProperty("width", "1px", "important");
  vGuide.style.setProperty("height", `${bottom - top + 8}px`, "important");
  vGuide.style.setProperty("display", "block", "important");
}

function showHorizontalGuide(y: number, left: number, right: number): void {
  hGuide = ensureGuide(hGuide);
  hGuide.style.setProperty("top", `${y}px`, "important");
  hGuide.style.setProperty("left", `${left - 4}px`, "important");
  hGuide.style.setProperty("height", "1px", "important");
  hGuide.style.setProperty("width", `${right - left + 8}px`, "important");
  hGuide.style.setProperty("display", "block", "important");
}

function hideEl(el: HTMLDivElement | null): void {
  el?.style.setProperty("display", "none", "important");
}
