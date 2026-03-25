/**
 * Element picker — handles hover highlighting and click-to-select.
 * Uses capture-phase event listeners to intercept before page handlers.
 * Coordinates with other interaction modes (drag, resize, edit).
 */

import {
  isOverlayElement,
  showHover,
  hideHover,
  showSelection,
  hideSelection,
  updateSelection,
  getHandleDirection,
} from "./overlay";

let isActive = false;
let hoveredElement: Element | null = null;
let selectedElement: Element | null = null;
let multiSelectedElements: Element[] = [];
let rafId: number | null = null;
/** When true, the picker ignores events (another mode is in control) */
let suspended = false;

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
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("scroll", onScroll, true);
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
  document.removeEventListener("keydown", onKeyDown, true);
  window.removeEventListener("scroll", onScroll, true);
  window.removeEventListener("resize", onResize);

  hideHover();
  hideSelection();
  selectedElement = null;
}

export function getSelectedElement(): Element | null {
  return selectedElement;
}

export function clearSelection(): void {
  selectedElement = null;
  multiSelectedElements = [];
  hideSelection();
  callbacks?.onSelect(null);
}

export function getMultiSelectedElements(): Element[] {
  return [...multiSelectedElements];
}

/** Pause the picker while another interaction mode is active */
export function suspendPicker(): void {
  suspended = true;
  hideHover();
}

/** Resume the picker after another interaction mode completes */
export function resumePicker(): void {
  suspended = false;
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
  hoveredElement = null;
  hideHover();
  showSelection(element);
  callbacks?.onSelect(element);
}

// --- Event handlers ---

function onMouseMove(e: MouseEvent): void {
  if (!isActive || suspended) return;

  const target = document.elementFromPoint(e.clientX, e.clientY);
  if (!target || target === hoveredElement) return;

  // Allow hover over resize handles (they're part of our overlay)
  if (isOverlayElement(target) && !getHandleDirection(target)) return;

  // Don't hover-highlight the currently selected element
  if (target === selectedElement || isOverlayElement(target)) {
    hideHover();
    hoveredElement = null;
    return;
  }

  // Skip html and body
  if (target === document.body || target === document.documentElement) {
    hideHover();
    hoveredElement = null;
    return;
  }

  hoveredElement = target;
  const rect = target.getBoundingClientRect();
  showHover(rect);
}

function onClick(e: MouseEvent): void {
  if (!isActive || suspended) return;

  const target = document.elementFromPoint(e.clientX, e.clientY);
  if (!target) return;

  // Allow resize handle clicks to pass through to mousedown handler
  if (getHandleDirection(target)) return;
  if (isOverlayElement(target)) return;

  // Prevent the page from handling this click
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  // Skip html and body
  if (target === document.body || target === document.documentElement) {
    clearSelection();
    return;
  }

  // If clicking the same element, don't deselect (allow double-click to work)
  if (target === selectedElement && !e.shiftKey) return;

  // Shift+Click: add/remove from multi-selection
  if (e.shiftKey && selectedElement) {
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
  multiSelectedElements = [];
  selectedElement = target;
  hoveredElement = null;
  hideHover();
  showSelection(target);
  callbacks?.onSelect(target);
}

function onDoubleClick(e: MouseEvent): void {
  if (!isActive || suspended) return;

  const target = document.elementFromPoint(e.clientX, e.clientY);
  if (!target || isOverlayElement(target)) return;

  if (target === selectedElement || selectedElement?.contains(target)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    callbacks?.onDoubleClick(selectedElement!, e);
  }
}

function onMouseDown(e: MouseEvent): void {
  if (!isActive || suspended) return;

  const target = e.target as Element;
  if (!target) return;

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
    }
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (!isActive || suspended || !selectedElement) return;
  if (e.key !== "Enter") return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  if (e.shiftKey) {
    // Shift+Enter: go up to parent
    const parent = selectedElement.parentElement;
    if (parent && parent !== document.body && parent !== document.documentElement) {
      selectedElement = parent;
      hoveredElement = null;
      hideHover();
      showSelection(selectedElement);
      callbacks?.onSelect(selectedElement);
    }
  } else {
    // Enter: go down to first child element
    const firstChild = selectedElement.children[0];
    if (firstChild && !isOverlayElement(firstChild)) {
      selectedElement = firstChild;
      hoveredElement = null;
      hideHover();
      showSelection(selectedElement);
      callbacks?.onSelect(selectedElement);
    }
  }
}

function onScroll(): void {
  if (suspended) return;
  if (hoveredElement) {
    const rect = hoveredElement.getBoundingClientRect();
    showHover(rect);
  }
  if (selectedElement) {
    updateSelection(selectedElement);
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
    rafId = null;
  });
}
