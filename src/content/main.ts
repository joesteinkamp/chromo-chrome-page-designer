/**
 * Page Designer content script entry point.
 * Manages activation state and coordinates all interaction modes:
 *   idle → picking (hover/click) → selected
 *   selected → dragging | resizing | editing
 */

import { initOverlay, destroyOverlay, getHandleDirection } from "./overlay";
import {
  startPicker,
  stopPicker,
  getSelectedElement,
  clearSelection,
  suspendPicker,
  resumePicker,
  refreshSelection,
} from "./element-picker";
import { extractElementData, applyStyleToElement } from "./style-bridge";
import { startInlineEdit, stopInlineEdit, isEditing } from "./inline-edit";
import { initDragDrop, isDragActive, cancelDrag } from "./drag-drop";
import { tryStartResize, isResizeActive } from "./resize";
import { showImageToolbar, hideImageToolbar } from "./image-replace";
import type { Message } from "../shared/messages";

let isActive = false;

// --- Message handling ---

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    switch (message.type) {
      case "ACTIVATE":
        activate();
        sendResponse({ type: "STATE_RESPONSE", isActive: true });
        break;

      case "DEACTIVATE":
        deactivate();
        sendResponse({ type: "STATE_RESPONSE", isActive: false });
        break;

      case "GET_STATE":
        sendResponse({ type: "STATE_RESPONSE", isActive });
        break;

      case "APPLY_STYLE": {
        const el = getSelectedElement();
        if (el && el instanceof HTMLElement) {
          applyStyleToElement(el, message.property, message.value);
          refreshSelection();
          // Send updated element data back to panel
          sendElementData(el);
        }
        break;
      }
    }
    return true;
  }
);

// --- Activation ---

function activate(): void {
  if (isActive) return;
  isActive = true;
  initOverlay();
  startPicker({
    onSelect: onElementSelected,
    onDoubleClick: onElementDoubleClick,
    onMouseDown: onElementMouseDown,
  });
}

function deactivate(): void {
  if (!isActive) return;
  isActive = false;

  // Clean up any active interaction
  stopInlineEdit();
  cancelDrag();
  hideImageToolbar();

  stopPicker();
  destroyOverlay();
}

// --- Selection callback ---

function onElementSelected(element: Element | null): void {
  hideImageToolbar();

  if (element) {
    sendElementData(element);

    // Show image toolbar if it's an image
    if (element.tagName.toLowerCase() === "img") {
      showImageToolbar(element);
    }
  } else {
    chrome.runtime.sendMessage({
      type: "ELEMENT_DESELECTED",
    } satisfies Message);
  }
}

// --- Double-click → inline text edit ---

function onElementDoubleClick(element: Element, _e: MouseEvent): void {
  if (!(element instanceof HTMLElement)) return;
  if (isEditing() || isDragActive() || isResizeActive()) return;

  suspendPicker();
  hideImageToolbar();

  const started = startInlineEdit(element, () => {
    // On edit complete
    resumePicker();
    refreshSelection();
    sendElementData(element);
  });

  if (!started) {
    resumePicker();
  }
}

// --- Mousedown → resize or drag ---

function onElementMouseDown(
  element: Element,
  target: Element,
  e: MouseEvent
): void {
  if (isEditing() || isDragActive() || isResizeActive()) return;
  if (!(element instanceof HTMLElement)) return;

  // Check if clicking a resize handle
  const handleDir = getHandleDirection(target);
  if (handleDir) {
    suspendPicker();
    hideImageToolbar();
    tryStartResize(target, element, e, () => {
      resumePicker();
      refreshSelection();
      sendElementData(element);
    });
    return;
  }

  // Otherwise start drag-and-drop tracking
  suspendPicker();
  hideImageToolbar();
  initDragDrop(element, e, () => {
    resumePicker();
    refreshSelection();
    // Re-select and send updated data
    const sel = getSelectedElement();
    if (sel) sendElementData(sel);
  });
}

// --- Helpers ---

function sendElementData(element: Element): void {
  const data = extractElementData(element);
  chrome.runtime.sendMessage({
    type: "ELEMENT_SELECTED",
    data,
  } satisfies Message);
}
