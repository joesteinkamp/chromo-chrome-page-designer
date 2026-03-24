/**
 * Page Designer content script entry point.
 * Manages activation state, coordinates all interaction modes,
 * tracks changes, and handles persistence replay.
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
import {
  recordStyleChange,
  recordTextChange,
  undoChange,
  undoAll,
  redoChange,
  getChanges,
  canRedo,
  clearChanges,
  replayChanges,
} from "./change-tracker";
import type { Message } from "../shared/messages";

let isActive = false;

// --- Message handling ---

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    switch (message.type) {
      case "ACTIVATE":
        activate();
        sendResponse({ type: "STATE_RESPONSE", isActive: true });
        // Also broadcast so the panel picks it up even if sendResponse is lost
        try {
          chrome.runtime.sendMessage({ type: "STATE_RESPONSE", isActive: true } satisfies Message);
        } catch { /* panel may not be open */ }
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
          // Record the old value before applying
          const computed = window.getComputedStyle(el);
          const oldValue = computed.getPropertyValue(message.property);

          applyStyleToElement(el, message.property, message.value);
          refreshSelection();

          // Track the change
          if (oldValue !== message.value) {
            recordStyleChange(el, message.property, oldValue, message.value);
          }

          sendElementData(el);
        }
        break;
      }

      case "APPLY_AI_CHANGES": {
        const el = getSelectedElement();
        if (el && el instanceof HTMLElement) {
          let appliedCount = 0;

          // Apply style changes
          if (message.styleChanges) {
            for (const { property, value } of message.styleChanges) {
              const computed = window.getComputedStyle(el);
              const oldValue = computed.getPropertyValue(property);
              applyStyleToElement(el, property, value);
              if (oldValue !== value) {
                recordStyleChange(el, property, oldValue, value);
                appliedCount++;
              }
            }
          }

          // Apply text change
          if (message.textContent !== undefined) {
            const oldText = el.textContent || "";
            el.textContent = message.textContent;
            if (oldText !== message.textContent) {
              recordTextChange(el, oldText, message.textContent);
              appliedCount++;
            }
          }

          refreshSelection();
          sendElementData(el);

          sendResponse({
            type: "AI_CHANGES_APPLIED",
            appliedCount,
          } as any);
        }
        return true;
      }

      // Note: TEXT_CHANGED, ELEMENT_MOVED, ELEMENT_RESIZED, IMAGE_REPLACED
      // are recorded directly by the interaction modules (inline-edit.ts,
      // drag-drop.ts, resize.ts, image-replace.ts) calling change-tracker
      // functions. chrome.runtime.sendMessage can't be received by the
      // same context that sent it.

      case "UNDO_CHANGE":
        undoChange(message.changeId);
        refreshSelection();
        // Send updated element data if something is selected
        const sel1 = getSelectedElement();
        if (sel1) sendElementData(sel1);
        break;

      case "UNDO_ALL":
        undoAll();
        refreshSelection();
        const sel2 = getSelectedElement();
        if (sel2) sendElementData(sel2);
        break;

      case "REDO":
        redoChange();
        refreshSelection();
        const sel3 = getSelectedElement();
        if (sel3) sendElementData(sel3);
        break;

      case "GET_CHANGES":
        sendResponse({
          type: "CHANGES_RESPONSE",
          changes: getChanges(),
          canRedo: canRedo(),
        } satisfies Message);
        return true;

      case "CLEAR_CHANGES":
        clearChanges();
        break;

      case "REPLAY_CHANGES": {
        const result = replayChanges(message.changes);
        sendResponse({
          type: "REPLAY_RESULT",
          applied: result.applied,
          failed: result.failed,
        } as any);
        return true;
      }

      case "SAVE_EDITS": {
        // Forward to background for storage
        chrome.runtime.sendMessage(message);
        break;
      }

      case "CAPTURE_SCREENSHOT": {
        // Forward to background
        chrome.runtime.sendMessage(message, (response: any) => {
          if (response?.type === "SCREENSHOT_CAPTURED" && response.dataUrl) {
            // Trigger download
            const link = document.createElement("a");
            link.href = response.dataUrl;
            link.download = `page-designer-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
          }
        });
        return true;
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

  // Check for saved edits
  chrome.runtime.sendMessage(
    { type: "CHECK_SAVED_EDITS", url: window.location.href } as any,
    (response: any) => {
      if (response?.hasSavedEdits) {
        // Notify the panel that saved edits exist
        chrome.runtime.sendMessage({
          type: "SAVED_EDITS_AVAILABLE",
          url: window.location.href,
        } as any);
      }
    }
  );
}

function deactivate(): void {
  if (!isActive) return;
  isActive = false;

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

  suspendPicker();
  hideImageToolbar();
  initDragDrop(element, e, () => {
    resumePicker();
    refreshSelection();
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
