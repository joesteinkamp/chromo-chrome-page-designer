/**
 * Drag to move — click and drag a selected element to reposition it
 * visually by adjusting CSS top/left (pixel movement), matching the
 * arrow-key nudge behaviour.
 */

import { recordStyleChange, startBatch, endBatch } from "./change-tracker";

let isDragging = false;
let dragElement: HTMLElement | null = null;
let startX = 0;
let startY = 0;
let startTop = 0;
let startLeft = 0;
let originalPosition = "";
let onDragEnd: (() => void) | null = null;

const DRAG_THRESHOLD = 3;
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

  const computed = window.getComputedStyle(element);
  startTop = parseFloat(computed.top) || 0;
  startLeft = parseFloat(computed.left) || 0;
  originalPosition = computed.position;

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

    // Ensure element is positioned for movement
    if (originalPosition === "static") {
      dragElement.style.setProperty("position", "relative", "important");
      recordStyleChange(dragElement, "position", "static", "relative");
    }

    startBatch();
  }

  const newTop = startTop + dy;
  const newLeft = startLeft + dx;

  dragElement.style.setProperty("top", `${newTop}px`, "important");
  dragElement.style.setProperty("left", `${newLeft}px`, "important");
}

function onMouseUp(_e: MouseEvent): void {
  if (!dragElement) {
    cleanup();
    return;
  }

  if (hasDragStarted && dragElement) {
    const computed = window.getComputedStyle(dragElement);
    const finalTop = computed.top;
    const finalLeft = computed.left;

    recordStyleChange(dragElement, "top", `${startTop}px`, finalTop);
    recordStyleChange(dragElement, "left", `${startLeft}px`, finalLeft);
    endBatch();
  }

  cleanup();
}

function cleanup(): void {
  document.removeEventListener("mousemove", onMouseMove, true);
  document.removeEventListener("mouseup", onMouseUp, true);

  isDragging = false;
  hasDragStarted = false;
  dragElement = null;
  originalPosition = "";

  onDragEnd?.();
  onDragEnd = null;
}
