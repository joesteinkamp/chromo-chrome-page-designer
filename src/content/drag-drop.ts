/**
 * Drag-and-drop element rearrangement.
 * Mousedown on selected element → ghost follows cursor → insertion line shows
 * drop position → mouseup moves the element in the DOM.
 */

import { isOverlayElement } from "./overlay";
import { generateSelector } from "../shared/selector";
import type { Message } from "../shared/messages";

let isDragging = false;
let dragElement: HTMLElement | null = null;
let ghost: HTMLDivElement | null = null;
let insertionLine: HTMLDivElement | null = null;
let dropTarget: Element | null = null;
let insertBefore: boolean = true;
let startX = 0;
let startY = 0;
let onDragEnd: (() => void) | null = null;

const DRAG_THRESHOLD = 5; // px before drag starts
let hasDragStarted = false;

export function initDragDrop(
  element: HTMLElement,
  e: MouseEvent,
  callback: () => void
): void {
  dragElement = element;
  startX = e.clientX;
  startY = e.clientY;
  hasDragStarted = false;
  onDragEnd = callback;

  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("mouseup", onMouseUp, true);
}

export function isDragActive(): boolean {
  return isDragging;
}

export function cancelDrag(): void {
  cleanup();
}

// --- Internal ---

function onMouseMove(e: MouseEvent): void {
  if (!dragElement) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  if (!hasDragStarted) {
    if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
    hasDragStarted = true;
    isDragging = true;
    createGhost();
    createInsertionLine();
    dragElement.style.opacity = "0.3";
  }

  // Move ghost
  if (ghost) {
    ghost.style.left = `${e.clientX + 10}px`;
    ghost.style.top = `${e.clientY + 10}px`;
  }

  // Find drop target
  // Temporarily hide ghost and drag element to get element underneath
  if (ghost) ghost.style.display = "none";
  const prevOpacity = dragElement.style.opacity;
  dragElement.style.pointerEvents = "none";

  const target = document.elementFromPoint(e.clientX, e.clientY);

  dragElement.style.pointerEvents = "";
  if (ghost) ghost.style.display = "block";

  if (
    target &&
    target !== dragElement &&
    !isOverlayElement(target) &&
    target !== document.body &&
    target !== document.documentElement &&
    !dragElement.contains(target)
  ) {
    dropTarget = target;
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    insertBefore = e.clientY < midY;

    // Position insertion line
    if (insertionLine) {
      const lineY = insertBefore ? rect.top : rect.bottom;
      insertionLine.style.cssText = `
        left: ${rect.left}px !important;
        top: ${lineY - 1}px !important;
        width: ${rect.width}px !important;
      `;
      insertionLine.classList.add("__pd-insertion-line--visible");
    }
  } else {
    dropTarget = null;
    insertionLine?.classList.remove("__pd-insertion-line--visible");
  }
}

function onMouseUp(e: MouseEvent): void {
  if (!dragElement) {
    cleanup();
    return;
  }

  if (hasDragStarted && dropTarget && dragElement) {
    // Record original position
    const originalParent = dragElement.parentElement;
    const originalIndex = originalParent
      ? Array.from(originalParent.children).indexOf(dragElement)
      : 0;
    const fromParentSelector = originalParent
      ? generateSelector(originalParent)
      : "body";

    // Move element
    const targetParent = dropTarget.parentElement;
    if (targetParent) {
      if (insertBefore) {
        targetParent.insertBefore(dragElement, dropTarget);
      } else {
        targetParent.insertBefore(dragElement, dropTarget.nextSibling);
      }

      // Record new position
      const newParent = dragElement.parentElement;
      const newIndex = newParent
        ? Array.from(newParent.children).indexOf(dragElement)
        : 0;
      const toParentSelector = newParent
        ? generateSelector(newParent)
        : "body";

      chrome.runtime.sendMessage({
        type: "ELEMENT_MOVED",
        selector: generateSelector(dragElement),
        fromParent: fromParentSelector,
        fromIndex: originalIndex,
        toParent: toParentSelector,
        toIndex: newIndex,
      } satisfies Message);
    }
  }

  cleanup();
}

function createGhost(): void {
  if (!dragElement) return;
  const rect = dragElement.getBoundingClientRect();

  ghost = document.createElement("div");
  ghost.className = "__pd-drag-ghost";
  ghost.style.cssText = `
    position: fixed !important;
    z-index: 2147483647 !important;
    width: ${Math.min(rect.width, 200)}px !important;
    height: ${Math.min(rect.height, 60)}px !important;
    background: rgba(79, 158, 255, 0.15) !important;
    border: 1.5px solid #4f9eff !important;
    border-radius: 4px !important;
    pointer-events: none !important;
    opacity: 0.8 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
    font-size: 11px !important;
    color: #4f9eff !important;
    box-sizing: border-box !important;
    padding: 4px 8px !important;
    overflow: hidden !important;
  `;
  ghost.textContent = `${dragElement.tagName.toLowerCase()}`;
  document.documentElement.appendChild(ghost);
}

function createInsertionLine(): void {
  insertionLine = document.createElement("div");
  insertionLine.className = "__pd-insertion-line";
  document.documentElement.appendChild(insertionLine);
}

function cleanup(): void {
  if (dragElement) {
    dragElement.style.opacity = "";
    dragElement.style.pointerEvents = "";
  }

  ghost?.remove();
  insertionLine?.remove();

  document.removeEventListener("mousemove", onMouseMove, true);
  document.removeEventListener("mouseup", onMouseUp, true);

  isDragging = false;
  hasDragStarted = false;
  dragElement = null;
  ghost = null;
  insertionLine = null;
  dropTarget = null;

  onDragEnd?.();
  onDragEnd = null;
}
