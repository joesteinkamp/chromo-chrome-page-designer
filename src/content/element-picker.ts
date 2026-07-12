/**
 * Element picker — handles hover highlighting and click-to-select.
 * Uses capture-phase event listeners to intercept before page handlers.
 * Coordinates with other interaction modes (drag, resize, edit).
 *
 * Selection follows Figma's model:
 *   - click selects at "container" depth (see resolveClickTarget)
 *   - double-click drills one level toward the cursor; on a leaf it starts
 *     inline text editing
 *   - Cmd/Ctrl+click selects the deepest element under the cursor
 *   - holding Alt with a selection measures distances to the hovered element
 */

import {
  isOverlayElement,
  showHover,
  hideHover,
  showSelection,
  hideSelection,
  updateSelection,
  updateMultiSelectOverlays,
  getHandleDirection,
} from "./overlay";
import { isLayersPaneElement } from "./layers-panel";
import { showMeasureTo, hideMeasure } from "./spacing-overlay";

let isActive = false;
let hoveredElement: Element | null = null;
let selectedElement: Element | null = null;
let multiSelectedElements: Element[] = [];
let rafId: number | null = null;
/** When true, the picker ignores events (another mode is in control) */
let suspended = false;
/** Swallow the click that the browser fires after a drag/resize mouseup —
 * re-hit-testing at the release point would hijack the selection. */
let suppressClickOnce = false;

// Marquee (rubber-band) selection — armed on mousedown over empty page
// space; activates once the pointer moves past a small threshold.
let marqueeStart: { x: number; y: number } | null = null;
let marqueeEl: HTMLDivElement | null = null;
const MARQUEE_THRESHOLD = 4;

export type PickerCallbacks = {
  onSelect: (element: Element | null) => void;
  onMultiSelect: (elements: Element[], primary: Element) => void;
  onDoubleClick: (element: Element, e: MouseEvent) => void;
  onMouseDown: (element: Element, target: Element, e: MouseEvent) => void;
};

let callbacks: PickerCallbacks | null = null;

export function startPicker(cbs: PickerCallbacks): void {
  isActive = true;
  callbacks = cbs;

  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("dblclick", onDoubleClick, true);
  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("mouseup", onMouseUp, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("scroll", onScroll, true);
  document.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onResize);
}

export function stopPicker(): void {
  isActive = false;
  callbacks = null;
  hoveredElement = null;
  suspended = false;

  document.removeEventListener("mousemove", onMouseMove, true);
  document.removeEventListener("click", onClick, true);
  document.removeEventListener("dblclick", onDoubleClick, true);
  document.removeEventListener("mousedown", onMouseDown, true);
  document.removeEventListener("mouseup", onMouseUp, true);
  document.removeEventListener("keydown", onKeyDown, true);
  document.removeEventListener("keyup", onKeyUp, true);
  window.removeEventListener("blur", onWindowBlur);
  window.removeEventListener("scroll", onScroll, true);
  document.removeEventListener("scroll", onScroll, true);
  window.removeEventListener("resize", onResize);

  hideHover();
  hideSelection();
  hideMeasure();
  cancelMarquee();
  selectedElement = null;
}

export function getSelectedElement(): Element | null {
  return selectedElement;
}

export function clearSelection(): void {
  selectedElement = null;
  multiSelectedElements = [];
  hideSelection();
  hideMeasure();
  callbacks?.onSelect(null);
}

export function getMultiSelectedElements(): Element[] {
  return [...multiSelectedElements];
}

/** Pause the picker while another interaction mode is active */
export function suspendPicker(): void {
  suspended = true;
  hideHover();
  hideMeasure();
  cancelMarquee();
}

/** Resume the picker after another interaction mode completes */
export function resumePicker(): void {
  suspended = false;
}

/** Ignore the next click event (called when a drag gesture just ended) */
export function suppressNextClick(): void {
  suppressClickOnce = true;
}

/** Refresh the selection overlay position */
export function refreshSelection(): void {
  if (selectedElement) {
    updateSelection(selectedElement);
  }
}

/** Programmatically select an element (used by keyboard nav, breadcrumbs) */
export function selectElementDirectly(element: Element): void {
  selectedElement = element;
  // A direct single-select replaces any multi-selection — leaving the list
  // populated would keep fanning edits out to stale elements.
  multiSelectedElements = [];
  hoveredElement = null;
  hideHover();
  showSelection(element);
  callbacks?.onSelect(element);
}

/**
 * Programmatically restore a multi-selection (used by undo/redo). Sets the
 * primary as the active selection and the full set as the multi-selection
 * list, but does NOT fire onSelect — the caller is expected to drive any
 * downstream side effects (multi-overlays, panel sync).
 */
export function selectMultipleDirectly(
  elements: Element[],
  primary: Element
): void {
  selectedElement = primary;
  multiSelectedElements = [...elements];
  hoveredElement = null;
  hideHover();
  showSelection(primary);
}

// --- Click-target resolution (Figma-style) ---

/** Container-ish tags used as click boundaries when nothing is selected. */
const BOUNDARY_TAGS = new Set([
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "NAV",
  "ASIDE",
  "MAIN",
  "FORM",
  "FIGURE",
  "TABLE",
  "DIALOG",
  "UL",
  "OL",
]);

/**
 * Resolve which element a click (or hover preview) lands on.
 *
 * - deep (Cmd/Ctrl held) → the raw deepest hit, unmodified.
 * - Clicking inside the current selection keeps it — double-click drills.
 * - With a selection elsewhere, resolve at the selection's working depth:
 *   the child of the deepest common ancestor that contains the hit. This is
 *   Figma's "level memory" — after drilling into one card, clicking the next
 *   card selects the card, not a leaf inside it.
 * - With no selection, walk up to the nearest sectioning/container boundary
 *   (the web stand-in for Figma's top-level frames); on div-only pages, fall
 *   back to the highest ancestor that isn't page-sized (see findBoundary).
 */
function resolveClickTarget(hit: Element, deep: boolean): Element {
  if (deep) return hit;

  if (selectedElement && selectedElement.isConnected) {
    if (selectedElement === hit || selectedElement.contains(hit)) {
      return selectedElement;
    }
    const common = findCommonAncestor(selectedElement, hit);
    if (common && common !== hit) {
      let node: Element = hit;
      while (node.parentElement && node.parentElement !== common) {
        node = node.parentElement;
      }
      if (node.parentElement === common) return node;
    }
  }

  return findBoundary(hit);
}

/**
 * Container boundary for a first click. The nearest sectioning ancestor wins;
 * on pages that render only divs (most React apps), fall back to structure:
 * the highest ancestor that still reads as a component rather than the page
 * itself — i.e. covers less than ~70% of the viewport. The raw hit is the
 * last resort (the leaf itself already dominates the viewport).
 */
const STRUCTURAL_MAX_VIEWPORT_RATIO = 0.7;

function findBoundary(hit: Element): Element {
  const viewportArea = window.innerWidth * window.innerHeight;
  let structural: Element = hit;
  let node: Element | null = hit;
  while (node && node !== document.body && node !== document.documentElement) {
    if (BOUNDARY_TAGS.has(node.tagName)) return node;
    const rect = node.getBoundingClientRect();
    if (rect.width * rect.height < viewportArea * STRUCTURAL_MAX_VIEWPORT_RATIO) {
      structural = node;
    }
    node = node.parentElement;
  }
  return structural;
}

function findCommonAncestor(a: Element, b: Element): Element | null {
  let node: Element | null = a.parentElement;
  while (node) {
    if (node.contains(b)) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Resolve the element a click at (x, y) would select — same rules as the
 * live picker. Used by the context menu to select before showing commands.
 */
export function resolveTargetAt(x: number, y: number, deep = false): Element | null {
  const hit = document.elementFromPoint(x, y);
  if (!hit || isOverlayElement(hit) || isLayersPaneElement(hit)) return null;
  if (hit === document.body || hit === document.documentElement) return null;
  if (hit.tagName === "IFRAME" || hit.tagName === "FRAME") return null;
  return resolveClickTarget(hit, deep);
}

// --- Marquee (rubber-band) selection ---

/**
 * True when a mousedown lands on "empty page space" — the body/html, or a
 * wrapper that effectively is the page (fills ~the whole viewport). Dragging
 * from there draws a marquee instead of doing nothing.
 */
function isPageBackground(el: Element): boolean {
  if (el === document.body || el === document.documentElement) return true;
  const rect = el.getBoundingClientRect();
  return (
    rect.width >= window.innerWidth * 0.95 &&
    rect.height >= window.innerHeight * 0.95
  );
}

function marqueeRect(e: MouseEvent): { left: number; top: number; right: number; bottom: number } {
  const start = marqueeStart!;
  return {
    left: Math.min(start.x, e.clientX),
    top: Math.min(start.y, e.clientY),
    right: Math.max(start.x, e.clientX),
    bottom: Math.max(start.y, e.clientY),
  };
}

function updateMarquee(e: MouseEvent): void {
  if (!marqueeStart) return;
  if (!marqueeEl) {
    const dx = e.clientX - marqueeStart.x;
    const dy = e.clientY - marqueeStart.y;
    if (Math.abs(dx) < MARQUEE_THRESHOLD && Math.abs(dy) < MARQUEE_THRESHOLD) return;
    marqueeEl = document.createElement("div");
    marqueeEl.className = "__pd-marquee";
    document.documentElement.appendChild(marqueeEl);
    hideHover();
    hideMeasure();
    hoveredElement = null;
  }
  const rect = marqueeRect(e);
  marqueeEl.style.cssText = `
    left: ${rect.left}px !important;
    top: ${rect.top}px !important;
    width: ${rect.right - rect.left}px !important;
    height: ${rect.bottom - rect.top}px !important;
  `;
}

function cancelMarquee(): void {
  marqueeStart = null;
  marqueeEl?.remove();
  marqueeEl = null;
}

/**
 * Select what the marquee touched: descend from body through the chain of
 * containers that fully enclose the rect, then take that container's
 * children that intersect it — "the five cards", not the whole section.
 */
function finishMarquee(rect: { left: number; top: number; right: number; bottom: number }): void {
  let container: Element = document.body;
  let descended = true;
  while (descended) {
    descended = false;
    for (const child of Array.from(container.children)) {
      if (isOverlayElement(child) || isLayersPaneElement(child)) continue;
      const r = child.getBoundingClientRect();
      if (
        r.left <= rect.left &&
        r.top <= rect.top &&
        r.right >= rect.right &&
        r.bottom >= rect.bottom
      ) {
        container = child;
        descended = true;
        break;
      }
    }
  }

  const candidates: Element[] = [];
  for (const child of Array.from(container.children)) {
    if (isOverlayElement(child) || isLayersPaneElement(child)) continue;
    const r = child.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (
      r.left < rect.right &&
      r.right > rect.left &&
      r.top < rect.bottom &&
      r.bottom > rect.top
    ) {
      candidates.push(child);
    }
  }

  if (candidates.length === 0) {
    clearSelection();
    return;
  }

  hideHover();
  hideMeasure();
  hoveredElement = null;
  selectedElement = candidates[0];

  if (candidates.length === 1) {
    multiSelectedElements = [];
    showSelection(candidates[0]);
    callbacks?.onSelect(candidates[0]);
    return;
  }

  multiSelectedElements = [...candidates];
  showSelection(candidates[0]);
  callbacks?.onMultiSelect(multiSelectedElements, candidates[0]);
}

// --- Event handlers ---

function onMouseMove(e: MouseEvent): void {
  if (!isActive || suspended) return;

  // An armed marquee owns the pointer until mouseup
  if (marqueeStart) {
    updateMarquee(e);
    return;
  }

  const hit = document.elementFromPoint(e.clientX, e.clientY);
  if (!hit) return;

  // Let layers pane handle its own events
  if (isLayersPaneElement(hit)) return;

  // Allow hover over resize handles (they're part of our overlay)
  if (isOverlayElement(hit) && !getHandleDirection(hit)) {
    hideMeasure();
    return;
  }

  if (isOverlayElement(hit)) {
    hideHover();
    hideMeasure();
    hoveredElement = null;
    return;
  }

  // Skip html and body
  if (hit === document.body || hit === document.documentElement) {
    hideHover();
    hideMeasure();
    hoveredElement = null;
    return;
  }

  // Skip iframes — let the iframe's own content script handle hover/selection
  if (hit.tagName === "IFRAME" || hit.tagName === "FRAME") {
    hideHover();
    hideMeasure();
    hoveredElement = null;
    return;
  }

  // Preview exactly what a click would select (Cmd/Ctrl previews deep hits)
  const target = resolveClickTarget(hit, e.metaKey || e.ctrlKey);

  // Alt + hover with a selection → Figma-style distance measurement
  if (e.altKey && selectedElement && target !== selectedElement) {
    showMeasureTo(selectedElement, target);
  } else {
    hideMeasure();
  }

  // Don't hover-highlight the currently selected element
  if (target === selectedElement) {
    hideHover();
    hoveredElement = null;
    return;
  }

  if (target === hoveredElement) return;
  hoveredElement = target;
  showHover(target.getBoundingClientRect());
}

function onClick(e: MouseEvent): void {
  if (!isActive || suspended) return;

  // The click that ends a drag gesture is not a selection intent
  if (suppressClickOnce) {
    suppressClickOnce = false;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return;
  }

  const hit = document.elementFromPoint(e.clientX, e.clientY);
  if (!hit) return;

  // Let layers pane handle its own click events
  if (isLayersPaneElement(hit)) return;

  // Allow resize handle clicks to pass through to mousedown handler
  if (getHandleDirection(hit)) return;
  if (isOverlayElement(hit)) return;

  // Skip iframes — let the iframe's own content script handle click
  if (hit.tagName === "IFRAME" || hit.tagName === "FRAME") return;

  // Prevent the page from handling this click
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  // Skip html and body
  if (hit === document.body || hit === document.documentElement) {
    clearSelection();
    return;
  }

  const target = resolveClickTarget(hit, e.metaKey || e.ctrlKey);

  // Clicking within the current selection keeps it (double-click drills)
  if (target === selectedElement && !e.shiftKey) return;

  // Shift+Click: add/remove from multi-selection
  if (e.shiftKey && selectedElement) {
    if (target === selectedElement) return;
    const idx = multiSelectedElements.indexOf(target);
    if (idx >= 0) {
      // Remove from multi-selection
      multiSelectedElements.splice(idx, 1);
    } else {
      // Ensure primary is in multi-select list
      if (!multiSelectedElements.includes(selectedElement)) {
        multiSelectedElements.push(selectedElement);
      }
      multiSelectedElements.push(target);
    }

    if (multiSelectedElements.length > 0) {
      callbacks?.onMultiSelect(multiSelectedElements, selectedElement);
    }
    return;
  }

  // Single select — clear multi-selection
  hideMeasure();
  multiSelectedElements = [];
  selectedElement = target;
  hoveredElement = null;
  hideHover();
  showSelection(target);
  callbacks?.onSelect(target);
}

function onDoubleClick(e: MouseEvent): void {
  if (!isActive || suspended) return;

  const hit = document.elementFromPoint(e.clientX, e.clientY);
  if (!hit || isOverlayElement(hit)) return;
  if (isLayersPaneElement(hit)) return;
  if (!selectedElement) return;
  if (hit !== selectedElement && !selectedElement.contains(hit)) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  // Drill one level toward the cursor (Figma double-click). When there's no
  // deeper element under the cursor, fall through to inline text editing.
  if (hit !== selectedElement) {
    let next: Element = hit;
    while (next.parentElement && next.parentElement !== selectedElement) {
      next = next.parentElement;
    }
    if (next.parentElement === selectedElement && !isOverlayElement(next)) {
      selectElementDirectly(next);
      return;
    }
  }

  callbacks?.onDoubleClick(selectedElement, e);
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.key === "Alt") hideMeasure();
}

function onWindowBlur(): void {
  // Alt+Tab away never delivers the Alt keyup or the marquee's mouseup —
  // don't strand measure lines or a live rubber band.
  hideMeasure();
  cancelMarquee();
}

function onMouseDown(e: MouseEvent): void {
  if (!isActive || suspended) return;

  const target = e.target as Element;
  if (!target) return;

  // Let layers pane handle its own events
  if (isLayersPaneElement(target)) return;

  // Check for resize handle click
  if (getHandleDirection(target) && selectedElement) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    callbacks?.onMouseDown(selectedElement, target, e);
    return;
  }

  // Check for mousedown on selected element (for drag)
  if (selectedElement && !isOverlayElement(target)) {
    const pageTarget = document.elementFromPoint(e.clientX, e.clientY);
    if (pageTarget === selectedElement || selectedElement.contains(pageTarget)) {
      // Don't prevent default yet — let click handler decide
      // But notify main.ts so it can start drag tracking
      callbacks?.onMouseDown(selectedElement, pageTarget || selectedElement, e);
      return;
    }
  }

  // Drag from empty page space → marquee selection. preventDefault stops the
  // browser from starting a native text selection under the rubber band.
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  if (
    e.button === 0 &&
    hit &&
    !isOverlayElement(hit) &&
    !isLayersPaneElement(hit) &&
    hit.tagName !== "IFRAME" &&
    hit.tagName !== "FRAME" &&
    isPageBackground(hit)
  ) {
    marqueeStart = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }
}

function onMouseUp(e: MouseEvent): void {
  if (!isActive || suspended) return;
  if (!marqueeStart) return;
  // Only a primary-button release completes the marquee
  if (e.button !== 0) return;

  if (!marqueeEl) {
    // Never crossed the threshold — a plain click; the click handler decides
    marqueeStart = null;
    return;
  }

  const rect = marqueeRect(e);
  cancelMarquee();
  // The click that follows this mouseup is part of the marquee gesture
  suppressClickOnce = true;
  finishMarquee(rect);
}

function onKeyDown(e: KeyboardEvent): void {
  if (!isActive || suspended) return;

  // Escape cancels an in-progress marquee before any other meaning of Esc
  if (e.key === "Escape" && marqueeStart) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    cancelMarquee();
    return;
  }

  if (!selectedElement) return;
  if (e.key !== "Enter") return;

  if (e.shiftKey) {
    // Shift+Enter: go up to parent
    const parent = selectedElement.parentElement;
    if (parent && parent !== document.body && parent !== document.documentElement) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      selectElementDirectly(parent);
    }
  } else {
    // Enter: go down to first child element if one exists
    const firstChild = Array.from(selectedElement.children).find(c => !isOverlayElement(c));
    if (firstChild) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      selectElementDirectly(firstChild);
    }
    // No child elements — don't consume the event, let keyboard.ts
    // handle it for inline text editing
  }
}

function onScroll(): void {
  if (suspended) return;
  // Measure lines are viewport-positioned; a scroll invalidates them
  hideMeasure();
  if (hoveredElement) {
    const rect = hoveredElement.getBoundingClientRect();
    showHover(rect);
  }
  if (selectedElement) {
    updateSelection(selectedElement);
  }
  if (multiSelectedElements.length > 0) {
    updateMultiSelectOverlays(multiSelectedElements);
  }
}

function onResize(): void {
  if (suspended) return;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    if (hoveredElement) {
      const rect = hoveredElement.getBoundingClientRect();
      showHover(rect);
    }
    if (selectedElement) {
      updateSelection(selectedElement);
    }
    if (multiSelectedElements.length > 0) {
      updateMultiSelectOverlays(multiSelectedElements);
    }
    rafId = null;
  });
}
