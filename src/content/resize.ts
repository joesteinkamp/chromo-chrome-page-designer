/**
 * Resize interaction — drag handles to resize elements.
 * 8 handles (corners + edges). Shift constrains aspect ratio (default for images).
 */

import { getHandleDirection, updateSelection } from "./overlay";
import { recordResizeChange } from "./change-tracker";
import { updateSpacing } from "./spacing-overlay";

type HandleDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

let isResizing = false;
let resizeElement: HTMLElement | null = null;
let handleDir: HandleDir | null = null;
let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;
let startLeft = 0;
let startTop = 0;
let origWidth = "";
let origHeight = "";
let constrainAspect = false;
let aspectRatio = 1;
let onResizeEnd: (() => void) | null = null;

export function tryStartResize(
  target: Element,
  element: HTMLElement,
  e: MouseEvent,
  callback: () => void
): boolean {
  const dir = getHandleDirection(target);
  if (!dir) return false;

  isResizing = true;
  resizeElement = element;
  handleDir = dir;
  startX = e.clientX;
  startY = e.clientY;
  onResizeEnd = callback;

  const rect = element.getBoundingClientRect();
  startWidth = rect.width;
  startHeight = rect.height;
  startLeft = rect.left;
  startTop = rect.top;
  aspectRatio = startWidth / startHeight;

  const computed = window.getComputedStyle(element);
  origWidth = computed.width;
  origHeight = computed.height;

  constrainAspect = element.tagName.toLowerCase() === "img";

  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("mouseup", onMouseUp, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keyup", onKeyUp, true);

  e.preventDefault();
  e.stopPropagation();

  return true;
}

export function isResizeActive(): boolean {
  return isResizing;
}

// --- Internal ---

function onMouseMove(e: MouseEvent): void {
  if (!resizeElement || !handleDir) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  const constrain = e.shiftKey ? !constrainAspect : constrainAspect;

  let newWidth = startWidth;
  let newHeight = startHeight;

  switch (handleDir) {
    case "e":
      newWidth = startWidth + dx;
      if (constrain) newHeight = newWidth / aspectRatio;
      break;
    case "w":
      newWidth = startWidth - dx;
      if (constrain) newHeight = newWidth / aspectRatio;
      break;
    case "s":
      newHeight = startHeight + dy;
      if (constrain) newWidth = newHeight * aspectRatio;
      break;
    case "n":
      newHeight = startHeight - dy;
      if (constrain) newWidth = newHeight * aspectRatio;
      break;
    case "se":
      newWidth = startWidth + dx;
      newHeight = startHeight + dy;
      if (constrain) newHeight = newWidth / aspectRatio;
      break;
    case "sw":
      newWidth = startWidth - dx;
      newHeight = startHeight + dy;
      if (constrain) newHeight = newWidth / aspectRatio;
      break;
    case "ne":
      newWidth = startWidth + dx;
      newHeight = startHeight - dy;
      if (constrain) newHeight = newWidth / aspectRatio;
      break;
    case "nw":
      newWidth = startWidth - dx;
      newHeight = startHeight - dy;
      if (constrain) newHeight = newWidth / aspectRatio;
      break;
  }

  newWidth = Math.max(10, newWidth);
  newHeight = Math.max(10, newHeight);

  resizeElement.style.setProperty("width", `${Math.round(newWidth)}px`, "important");
  resizeElement.style.setProperty("height", `${Math.round(newHeight)}px`, "important");

  if (resizeElement.tagName.toLowerCase() === "img") {
    (resizeElement as HTMLImageElement).width = Math.round(newWidth);
    (resizeElement as HTMLImageElement).height = Math.round(newHeight);
  }

  updateSelection(resizeElement);
  updateSpacing();
}

function onMouseUp(e: MouseEvent): void {
  if (!resizeElement) {
    cleanup();
    return;
  }

  const computed = window.getComputedStyle(resizeElement);
  const newWidth = computed.width;
  const newHeight = computed.height;

  if (newWidth !== origWidth || newHeight !== origHeight) {
    recordResizeChange(
      resizeElement,
      { width: origWidth, height: origHeight },
      { width: newWidth, height: newHeight }
    );
  }

  cleanup();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    if (resizeElement) {
      resizeElement.style.setProperty("width", origWidth, "important");
      resizeElement.style.setProperty("height", origHeight, "important");
      updateSelection(resizeElement);
    }
    cleanup();
  }
}

function onKeyUp(_e: KeyboardEvent): void {}

function cleanup(): void {
  document.removeEventListener("mousemove", onMouseMove, true);
  document.removeEventListener("mouseup", onMouseUp, true);
  document.removeEventListener("keydown", onKeyDown, true);
  document.removeEventListener("keyup", onKeyUp, true);

  isResizing = false;
  resizeElement = null;
  handleDir = null;

  onResizeEnd?.();
  onResizeEnd = null;
}
