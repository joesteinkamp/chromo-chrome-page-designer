/**
 * Chromo Design content script entry point.
 * Manages activation state, coordinates all interaction modes,
 * tracks changes, and handles persistence replay.
 */

import { initOverlay, destroyOverlay, getHandleDirection, showMultiEditOverlays, hideMultiEditOverlays, updateMultiEditOverlays, showMultiSelectOverlays, hideMultiSelectOverlays } from "./overlay";
import { forcePseudoState, clearAllForcedStates } from "./pseudo-state";
import {
  startPicker,
  stopPicker,
  getSelectedElement,
  getMultiSelectedElements,
  clearSelection,
  suspendPicker,
  resumePicker,
  refreshSelection,
  selectElementDirectly,
} from "./element-picker";
import { extractElementData, applyStyleToElement, findMatchingElements } from "./style-bridge";
import { startInlineEdit, stopInlineEdit, isEditing } from "./inline-edit";
import { initDragDrop, isDragActive, cancelDrag } from "./drag-drop";
import { tryStartResize, isResizeActive } from "./resize";
import { showImageToolbar, hideImageToolbar } from "./image-replace";
import { initKeyboard, destroyKeyboard } from "./keyboard";
import { showSpacing, hideSpacing } from "./spacing-overlay";
import {
  recordStyleChange,
  recordTextChange,
  undoChange,
  undoAll,
  redoChange,
  redoLast,
  getChanges,
  canRedo,
  clearChanges,
  replayChanges,
  recordWrapChange,
  recordDuplicateChange,
} from "./change-tracker";
import type { Message } from "../shared/messages";

let isActive = false;
let multiEditEnabled = false;

/** Safely send a message — auto-deactivate if extension context is invalidated */
function safeSendMessage(message: Message, responseCallback?: (response: any) => void): void {
  try {
    if (!chrome.runtime?.id) {
      // Extension context already invalidated
      deactivate();
      return;
    }
    if (responseCallback) {
      chrome.runtime.sendMessage(message, responseCallback);
    } else {
      chrome.runtime.sendMessage(message).catch(handleContextError);
    }
  } catch {
    handleContextError();
  }
}

function handleContextError(): void {
  // Extension was reloaded/updated — clean up the old content script
  if (isActive) deactivate();
}

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

      case "TOGGLE_MULTI_EDIT": {
        multiEditEnabled = message.enabled;
        const sel = getSelectedElement();
        if (sel && multiEditEnabled) {
          const matches = findMatchingElements(sel);
          showMultiEditOverlays(matches);
        } else {
          hideMultiEditOverlays();
        }
        break;
      }

      case "APPLY_STYLE": {
        const el = getSelectedElement();
        if (el && el instanceof HTMLElement) {
          // Apply to primary element
          const computed = window.getComputedStyle(el);
          const oldValue = computed.getPropertyValue(message.property);

          // Apply to selected element
          applyStyleToElement(el, message.property, message.value);

          // Apply to all matching elements if multi-edit is on
          if (multiEditEnabled) {
            const matches = findMatchingElements(el);
            for (const match of matches) {
              if (match instanceof HTMLElement) {
                applyStyleToElement(match, message.property, message.value);
              }
            }
            updateMultiEditOverlays(matches);
          }

          if (oldValue !== message.value) {
            recordStyleChange(el, message.property, oldValue, message.value);
          }

          // Apply to multi-selected elements too
          const multiEls = getMultiSelectedElements();
          for (const multiEl of multiEls) {
            if (multiEl !== el && multiEl instanceof HTMLElement) {
              const mc = window.getComputedStyle(multiEl);
              const mv = mc.getPropertyValue(message.property);
              applyStyleToElement(multiEl, message.property, message.value);
              if (mv !== message.value) {
                recordStyleChange(multiEl, message.property, mv, message.value);
              }
            }
          }

          refreshSelection();

          // Visual flash feedback
          el.classList.remove("__pd-flash");
          void el.offsetWidth;
          el.classList.add("__pd-flash");
          setTimeout(() => el.classList.remove("__pd-flash"), 400);

          sendElementData(el);
        }
        break;
      }

      case "APPLY_STYLE_TO_MATCHING": {
        const elements = document.querySelectorAll(`.${CSS.escape(message.className)}`);
        elements.forEach((el) => {
          if (el instanceof HTMLElement) {
            const computed = window.getComputedStyle(el);
            const oldValue = computed.getPropertyValue(message.property);
            applyStyleToElement(el, message.property, message.value);
            if (oldValue !== message.value) {
              recordStyleChange(el, message.property, oldValue, message.value);
            }
          }
        });
        refreshSelection();
        const selEl = getSelectedElement();
        if (selEl) sendElementData(selEl);
        break;
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
      case "REDO_CHANGE":
        redoLast();
        refreshSelection();
        const sel3 = getSelectedElement();
        if (sel3) sendElementData(sel3);
        break;

      case "SELECT_ELEMENT": {
        const target = document.querySelector(message.selector);
        if (target) {
          selectElementDirectly(target);
          onElementSelected(target);
        }
        break;
      }

      case "WRAP_ELEMENT": {
        const wrapEl = getSelectedElement();
        if (wrapEl && wrapEl instanceof HTMLElement) {
          const allEls = collectSelectedElements(wrapEl);
          const wrapper = wrapElementsInGroup(allEls);
          if (wrapper) {
            selectElementDirectly(wrapper);
            onElementSelected(wrapper);
          }
        }
        break;
      }

      case "FORCE_PSEUDO_STATE": {
        const pseudoEl = getSelectedElement();
        if (pseudoEl) {
          forcePseudoState(pseudoEl, message.states);
          // Re-read styles after forcing pseudo-state
          sendElementData(pseudoEl);
        }
        break;
      }

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
        safeSendMessage(message);
        break;
      }

      case "CAPTURE_SCREENSHOT": {
        // Forward to background
        safeSendMessage(message, (response: any) => {
          if (response?.type === "SCREENSHOT_CAPTURED" && response.dataUrl) {
            // Trigger download
            const link = document.createElement("a");
            link.href = response.dataUrl;
            link.download = `chromo-design-${Date.now()}.png`;
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
    onMultiSelect: onMultiSelect,
    onDoubleClick: onElementDoubleClick,
    onMouseDown: onElementMouseDown,
  });
  initKeyboard({
    getSelectedElement,
    clearSelection,
    selectElement: (el) => {
      selectElementDirectly(el);
      onElementSelected(el);
    },
    startInlineEdit: (el) => onElementDoubleClick(el, new MouseEvent("dblclick")),
    refreshSelection,
    sendElementData,
    wrapInGroup: (el) => {
      const allEls = collectSelectedElements(el);
      const wrapper = wrapElementsInGroup(allEls);
      if (wrapper) {
        selectElementDirectly(wrapper);
        onElementSelected(wrapper);
      }
    },
    duplicateElement: (el) => {
      const clone = duplicateElement(el);
      if (clone) {
        selectElementDirectly(clone);
        onElementSelected(clone);
      }
    },
  });

  // Check for saved edits
  safeSendMessage(
    { type: "CHECK_SAVED_EDITS", url: window.location.href } as any,
    (response: any) => {
      if (response?.hasSavedEdits) {
        safeSendMessage({
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
  hideMultiEditOverlays();
  clearAllForcedStates();
  multiEditEnabled = false;
  hideSpacing();

  stopPicker();
  destroyKeyboard();
  destroyOverlay();
}

// --- Selection callback ---

function onElementSelected(element: Element | null): void {
  hideImageToolbar();
  hideMultiEditOverlays();
  hideMultiSelectOverlays();
  hideSpacing();

  if (element) {
    sendElementData(element);
    try { showSpacing(element); } catch { /* spacing overlay is optional */ }
    if (element.tagName.toLowerCase() === "img") {
      showImageToolbar(element);
    }
    // Show multi-edit overlays if enabled
    if (multiEditEnabled) {
      const matches = findMatchingElements(element);
      if (matches.length > 0) {
        showMultiEditOverlays(matches);
      }
    }
  } else {
    safeSendMessage({
      type: "ELEMENT_DESELECTED",
    } satisfies Message);
  }
}

// --- Multi-select callback ---

function onMultiSelect(elements: Element[], primary: Element): void {
  hideImageToolbar();
  const nonPrimary = elements.filter((el) => el !== primary);
  showMultiSelectOverlays(nonPrimary);
  sendElementData(primary);
  safeSendMessage({
    type: "MULTI_ELEMENT_SELECTED",
    count: elements.length,
    data: extractElementData(primary),
  } satisfies Message);
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
  safeSendMessage({
    type: "ELEMENT_SELECTED",
    data,
  } satisfies Message);
}

/** Collect primary + multi-selected elements as HTMLElements */
function collectSelectedElements(primary: HTMLElement): HTMLElement[] {
  const multiEls = getMultiSelectedElements();
  const all = new Set<HTMLElement>();
  all.add(primary);
  for (const el of multiEls) {
    if (el instanceof HTMLElement) all.add(el);
  }
  return Array.from(all);
}

/** Wrap one or more elements in a new div container and record the change */
function wrapElementsInGroup(elements: HTMLElement[]): HTMLElement | null {
  if (elements.length === 0) return null;

  // Sort by DOM order so the wrapper goes at the first element's position
  elements.sort((a, b) => {
    const pos = a.compareDocumentPosition(b);
    return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });

  const first = elements[0];
  const parent = first.parentElement;
  if (!parent) return null;

  const wrapper = document.createElement("div");
  wrapper.classList.add("__pd-group");
  parent.insertBefore(wrapper, first);

  for (const el of elements) {
    wrapper.appendChild(el);
  }

  recordWrapChange(first, wrapper);
  return wrapper;
}

/** Duplicate an element by cloning it and inserting after the original */
function duplicateElement(element: HTMLElement): HTMLElement | null {
  const clone = element.cloneNode(true) as HTMLElement;
  element.after(clone);
  recordDuplicateChange(element, clone);
  return clone;
}
