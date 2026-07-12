/**
 * Chromo Design content script entry point.
 * Manages activation state, coordinates all interaction modes,
 * tracks changes, and handles persistence replay.
 */

import {
  initOverlay,
  destroyOverlay,
  getHandleDirection,
  isOverlayElement,
  showMultiEditOverlays,
  hideMultiEditOverlays,
  updateMultiEditOverlays,
  showMultiSelectOverlays,
  hideMultiSelectOverlays,
  setCommentButtonHandler,
  setCommentPinClickHandler,
  setCommentPins,
  updateCommentPins,
} from "./overlay";
import {
  openCommentPopover,
  closeCommentPopover,
  isPopoverOpen,
} from "./comment-popover";
import { forcePseudoState, clearAllForcedStates } from "./pseudo-state";
import {
  startPicker,
  stopPicker,
  getSelectedElement,
  getMultiSelectedElements,
  clearSelection,
  suspendPicker,
  resumePicker,
  suppressNextClick,
  refreshSelection,
  selectElementDirectly,
  resolveTargetAt,
  selectMultipleDirectly,
} from "./element-picker";
import { extractElementData, extractMergedElementData, applyStyleToElement, findMatchingElements, removeAutoLayout, collectPageTokens, setTokenOverride, getTokenValue } from "./style-bridge";
import { applyComponentProp, extractComponentInfo } from "./framework-detect";
import { startInlineEdit, stopInlineEdit, isEditing } from "./inline-edit";
import { initDragDrop, isDragActive, cancelDrag } from "./drag-drop";
import { tryStartResize, isResizeActive } from "./resize";
import { showImageToolbar, hideImageToolbar } from "./image-replace";
import { showMoveToolbar, hideMoveToolbar } from "./move-mode";
import { initKeyboard, destroyKeyboard } from "./keyboard";
import { showSpacing, hideSpacing, updateSpacing, hideMeasure } from "./spacing-overlay";
import {
  recordSelectionChange,
  recordMultiSelectionChange,
  clearSelectionHistory,
} from "./selection-history";
import {
  mountLayersPanel,
  unmountLayersPanel,
  isMounted as isLayersPaneMounted,
  isLayersPaneElement,
  setSelectedInTree,
} from "./layers-panel";
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
  recordDeleteChange,
  recordHideChange,
  recordPropChange,
  recordTokenChange,
  startBatch,
  endBatch,
  recordCommentChange,
  updateCommentChange,
  deleteCommentChange,
  getComments,
  subscribeComments,
} from "./change-tracker";
import { generateSelector } from "../shared/selector";
import {
  showContextMenu,
  hideContextMenu,
  type MenuEntry,
} from "./context-menu";
import {
  copyElement,
  copyStyles,
  pasteElement,
  pasteStyles,
  hasCopiedElement,
  hasCopiedStyles,
} from "./clipboard";
import type { Message } from "../shared/messages";

let isActive = false;
let multiEditEnabled = false;
/** Whether this content script is running inside an iframe */
const isInIframe = window !== window.top;
/** Unsubscribe callback for comments listener (set up on activate) */
let unsubscribeComments: (() => void) | null = null;

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

      case "DESELECT_FRAME":
        // Another frame got a selection — clear ours
        if (getSelectedElement()) {
          clearSelection();
          hideImageToolbar();
          hideMultiEditOverlays();
          hideMultiSelectOverlays();
          hideSpacing();
        }
        break;

      case "TOGGLE_LAYERS_PANE": {
        if (isInIframe) break; // Only mount in the top frame
        if (message.enabled) {
          // The pane calls showSelection / showHover through the picker, which
          // requires the overlay module to be initialized. Auto-activate so
          // clicks from the tree always work even if the user toggled the
          // pane before clicking the activate button.
          if (!isActive) activate();
          if (!isLayersPaneMounted()) {
            mountLayersPanel((el) => {
              // Click in the tree → route through the standard selection flow
              onElementSelected(el);
            });
            const sel = getSelectedElement();
            if (sel) setSelectedInTree(sel);
          }
        } else {
          unmountLayersPanel();
        }
        break;
      }

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
        if (el && (el instanceof HTMLElement || el instanceof SVGElement)) {
          // Batch only when several ELEMENTS receive the write — a batched
          // single-element change would defeat the tracker's coalescing of
          // repeated slider ticks.
          const hasMultiple =
            getMultiSelectedElements().length > 0 ||
            (multiEditEnabled && findMatchingElements(el).length > 0);
          if (hasMultiple) startBatch();
          applyPropertyToSelection(el, message.property, message.value);
          if (hasMultiple) endBatch();

          finishStyleApplication(el);
        }
        break;
      }

      case "APPLY_STYLES": {
        // Several properties as ONE undoable batch (aspect-locked W+H, etc.)
        const el = getSelectedElement();
        if (el && (el instanceof HTMLElement || el instanceof SVGElement)) {
          startBatch();
          for (const { property, value } of message.changes) {
            applyPropertyToSelection(el, property, value);
          }
          endBatch();
          finishStyleApplication(el);
        }
        break;
      }

      case "REMOVE_AUTO_LAYOUT": {
        const el = getSelectedElement();
        if (el && (el instanceof HTMLElement || el instanceof SVGElement)) {
          const multiEls = getMultiSelectedElements();
          const matches = multiEditEnabled ? findMatchingElements(el) : [];

          // Removing auto layout touches several properties at once — batch them
          // so a single undo restores the whole layout.
          startBatch();

          const stripLayout = (target: HTMLElement | SVGElement) => {
            for (const c of removeAutoLayout(target)) {
              recordStyleChange(target, c.property, c.from, c.to);
            }
          };

          stripLayout(el);
          for (const match of matches) {
            if (match instanceof HTMLElement || match instanceof SVGElement) {
              stripLayout(match);
            }
          }
          for (const multiEl of multiEls) {
            if (multiEl !== el && (multiEl instanceof HTMLElement || multiEl instanceof SVGElement)) {
              stripLayout(multiEl);
            }
          }
          if (matches.length > 0) updateMultiEditOverlays(matches);

          endBatch();

          refreshSelection();

          // Visual flash feedback (force reflow between class toggles)
          el.classList.remove("__pd-flash");
          void el.getBoundingClientRect();
          el.classList.add("__pd-flash");
          setTimeout(() => el.classList.remove("__pd-flash"), 400);

          sendElementData(el);
        }
        break;
      }

      case "APPLY_PROP": {
        const el = getSelectedElement();
        if (el) {
          // Read the current prop value before applying so the change records from → to
          let from: string | number | boolean | null = null;
          let fromType: "string" | "number" | "boolean" | "null" = "null";
          let fromKnown = false;
          try {
            const info = extractComponentInfo(el);
            const prop = info?.props?.find((p) => p.name === message.propName);
            if (prop) {
              from = prop.value;
              fromType = prop.type;
              fromKnown = true;
            }
          } catch { /* component info is best-effort */ }

          const applied = applyComponentProp(el, message.framework, message.componentName, message.propName, message.propValue, message.propType);
          // Only record when the original value was readable — otherwise undo
          // would write a fabricated null into the component.
          if (applied && fromKnown && from !== message.propValue) {
            recordPropChange(
              el, message.framework, message.componentName, message.propName,
              from, fromType, message.propValue, message.propType
            );
          }
          // Wait a frame for the framework to re-render, then refresh
          requestAnimationFrame(() => {
            refreshSelection();
            sendElementData(el);
          });
        }
        break;
      }

      case "APPLY_STYLE_TO_MATCHING": {
        const elements = document.querySelectorAll(`.${CSS.escape(message.className)}`);
        elements.forEach((el) => {
          if (el instanceof HTMLElement || el instanceof SVGElement) {
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

      case "APPLY_TEXT": {
        const textTarget = document.querySelector(message.selector);
        if (textTarget && textTarget instanceof HTMLElement) {
          const oldText = textTarget.textContent || "";
          textTarget.textContent = message.text;
          recordTextChange(textTarget, oldText, message.text);
          refreshSelection();
          sendElementData(textTarget);
        }
        break;
      }

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
          // Wait a frame for styles to settle, then re-read and send to panel
          requestAnimationFrame(() => {
            sendElementData(pseudoEl);
            refreshSelection();
          });
        }
        break;
      }

      case "GET_SELECTED_RECT": {
        const rectEl = getSelectedElement();
        const r = rectEl?.getBoundingClientRect();
        sendResponse({
          type: "SELECTED_RECT_RESPONSE",
          rect: r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null,
        } satisfies Message);
        return true;
      }

      case "GET_PAGE_TOKENS":
        sendResponse({
          type: "PAGE_TOKENS_RESPONSE",
          tokens: collectPageTokens(),
        } satisfies Message);
        return true;

      case "APPLY_TOKEN": {
        const from = getTokenValue(message.name);
        setTokenOverride(message.name, message.value);
        if (from !== message.value) {
          recordTokenChange(message.name, from, message.value);
        }
        // Token edits can restyle the selected element — refresh the inspector
        const tokenSel = getSelectedElement();
        if (tokenSel) {
          requestAnimationFrame(() => {
            refreshSelection();
            sendElementData(tokenSel);
          });
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

      case "HIDE_OVERLAYS":
        document.documentElement.classList.add("__pd-hide-overlays");
        sendResponse({});
        return true;

      case "SHOW_OVERLAYS":
        document.documentElement.classList.remove("__pd-hide-overlays");
        sendResponse({});
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

  // Wire up comment interactions: clicking the (+) button opens the popover
  // anchored to the current selection; clicking an existing pin opens it in
  // edit mode with the existing comment loaded.
  setCommentButtonHandler(() => openCommentPopoverForSelection());
  setCommentPinClickHandler((changeId) => openCommentPopoverForPin(changeId));

  // Sync comment pin markers whenever the comment list changes (add / edit /
  // delete / undo / redo / replay from saved edits).
  unsubscribeComments = subscribeComments((comments) => {
    setCommentPins(comments.map((c) => ({
      id: c.id,
      number: c.number,
      selector: c.selector,
    })));
  });
  // Hydrate pins from any existing comments (e.g. after a replay).
  setCommentPins(getComments().map((c) => ({
    id: c.id,
    number: c.number,
    selector: c.selector,
  })));

  // Keep pins aligned when the page scrolls or resizes. Selection-overlay
  // reposition already calls updateCommentPins() internally, but we also need
  // updates when nothing is selected.
  window.addEventListener("scroll", updateCommentPins, true);
  document.addEventListener("scroll", updateCommentPins, true);
  window.addEventListener("resize", updateCommentPins);

  // Keep spacing/padding overlay in sync with the element when page scrolls or resizes.
  window.addEventListener("scroll", updateSpacing, true);
  document.addEventListener("scroll", updateSpacing, true);
  window.addEventListener("resize", updateSpacing);

  document.addEventListener("contextmenu", onContextMenu, true);

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
    selectMulti: (elements, primary) => {
      selectMultipleDirectly(elements, primary);
      onMultiSelect(elements, primary);
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
      // Duplicates the whole multi-selection when one is live
      const clone = duplicateSelectedElements(el);
      if (clone) {
        selectElementDirectly(clone);
        onElementSelected(clone);
      }
    },
    hideElement: (el) => hideSelectedElements(el),
    deleteElement: (el) => {
      deleteSelectedElements(el);
      clearSelection();
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
  hideMoveToolbar();
  hideMultiEditOverlays();
  hideMultiSelectOverlays();
  clearAllForcedStates();
  multiEditEnabled = false;
  hideSpacing();
  hideMeasure();
  hideContextMenu();
  document.removeEventListener("contextmenu", onContextMenu, true);

  closeCommentPopover();
  unsubscribeComments?.();
  unsubscribeComments = null;
  window.removeEventListener("scroll", updateCommentPins, true);
  document.removeEventListener("scroll", updateCommentPins, true);
  window.removeEventListener("resize", updateCommentPins);
  window.removeEventListener("scroll", updateSpacing, true);
  document.removeEventListener("scroll", updateSpacing, true);
  window.removeEventListener("resize", updateSpacing);

  stopPicker();
  destroyKeyboard();
  destroyOverlay();
  clearSelectionHistory();
  unmountLayersPanel();
}

// --- Selection callback ---

function onElementSelected(element: Element | null): void {
  // Record the selection transition for Figma-style undo/redo of selection
  // state. No-op when suppressed (i.e. when we're restoring from history).
  recordSelectionChange(element);

  hideImageToolbar();
  hideMoveToolbar();
  hideMultiEditOverlays();
  hideMultiSelectOverlays();
  hideSpacing();

  // Keep the layers pane (if open) in sync with the active selection.
  if (isLayersPaneMounted()) {
    setSelectedInTree(element);
  }

  if (element) {
    sendElementData(element);
    try { showSpacing(element); } catch { /* spacing overlay is optional */ }
    if (element.tagName.toLowerCase() === "img") {
      showImageToolbar(element);
    }
    if (element instanceof HTMLElement || element instanceof SVGElement) {
      showMoveToolbar(element, () => {
        refreshSelection();
      });
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
  // Record the multi-selection transition so Cmd+Z can restore it.
  // No-op when suppressed (i.e. we're restoring from history).
  recordMultiSelectionChange(elements, primary);

  hideImageToolbar();
  hideMoveToolbar();
  hideMultiEditOverlays();
  hideSpacing();
  const nonPrimary = elements.filter((el) => el !== primary);
  showMultiSelectOverlays(nonPrimary);
  // sendElementData broadcasts the plain ELEMENT_SELECTED for non-panel
  // consumers, then follows with the merged MULTI_ELEMENT_SELECTED (with
  // Figma-style "Mixed" placeholders) that the panel settles on.
  sendElementData(primary);
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
  if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) return;

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
  initDragDrop(element, e, (finalElement, didDrag) => {
    resumePicker();
    // The mouseup of a real drag is followed by a click — swallow it so the
    // release point doesn't re-select whatever sits under the cursor.
    if (didDrag) suppressNextClick();
    if (finalElement && finalElement !== element && finalElement.isConnected) {
      // Alt-drag duplicated — selection moves to the dragged copy
      selectElementDirectly(finalElement);
      onElementSelected(finalElement);
      return;
    }
    refreshSelection();
    const sel = getSelectedElement();
    if (sel) sendElementData(sel);
  });
}

// --- Style application ---

/** Apply one property to the primary element plus the multi-selection and
 *  (when multi-edit is on) all matching instances, recording each change.
 *  Batching decisions belong to the caller. */
function applyPropertyToSelection(
  el: HTMLElement | SVGElement,
  property: string,
  value: string
): void {
  const computed = window.getComputedStyle(el);
  const oldValue = computed.getPropertyValue(property);

  applyStyleToElement(el, property, value);
  if (oldValue !== value) {
    recordStyleChange(el, property, oldValue, value);
  }

  const matches = multiEditEnabled ? findMatchingElements(el) : [];
  for (const match of matches) {
    if (match instanceof HTMLElement || match instanceof SVGElement) {
      const mc = window.getComputedStyle(match);
      const mv = mc.getPropertyValue(property);
      applyStyleToElement(match, property, value);
      if (mv !== value) {
        recordStyleChange(match, property, mv, value);
      }
    }
  }
  if (matches.length > 0) updateMultiEditOverlays(matches);

  for (const multiEl of getMultiSelectedElements()) {
    if (multiEl !== el && (multiEl instanceof HTMLElement || multiEl instanceof SVGElement)) {
      const mc = window.getComputedStyle(multiEl);
      const mv = mc.getPropertyValue(property);
      applyStyleToElement(multiEl, property, value);
      if (mv !== value) {
        recordStyleChange(multiEl, property, mv, value);
      }
    }
  }
}

/** Shared tail of every panel-driven style write: refresh overlays, flash
 *  the element, and send fresh element data back to the panel. */
function finishStyleApplication(el: HTMLElement | SVGElement): void {
  refreshSelection();

  // Visual flash feedback (force reflow between class toggles)
  el.classList.remove("__pd-flash");
  void el.getBoundingClientRect();
  el.classList.add("__pd-flash");
  setTimeout(() => el.classList.remove("__pd-flash"), 400);

  sendElementData(el);
}

// --- Right-click context menu ---

function onContextMenu(e: MouseEvent): void {
  if (!isActive) return;
  hideContextMenu();

  const hit = document.elementFromPoint(e.clientX, e.clientY);
  if (!hit) return;
  // Keep the native menu on our own UI, the layers pane, empty page space,
  // and iframes (their own content script handles them).
  if (isOverlayElement(hit) || isLayersPaneElement(hit)) return;
  if (hit === document.body || hit === document.documentElement) return;
  if (hit.tagName === "IFRAME" || hit.tagName === "FRAME") return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  // Figma-style: right-clicking outside the selection selects the target
  // first. A hit on ANY member of a multi-selection counts as inside — the
  // selection must survive so menu commands can act on the whole set.
  let target = getSelectedElement();
  const insideSelection =
    (target && (hit === target || target.contains(hit))) ||
    getMultiSelectedElements().some((m) => m === hit || m.contains(hit));
  if (!insideSelection) {
    const resolved = resolveTargetAt(e.clientX, e.clientY, e.metaKey || e.ctrlKey);
    if (!resolved) return;
    selectElementDirectly(resolved);
    onElementSelected(resolved);
    target = resolved;
  }
  if (!(target instanceof HTMLElement)) return;

  showContextMenu(e.clientX, e.clientY, buildContextMenuEntries(target));
}

/** Every entry reuses an existing command path and shows its shortcut, so the
 *  menu doubles as shortcut discovery. */
function buildContextMenuEntries(el: HTMLElement): MenuEntry[] {
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const mod = isMac ? "⌘" : "Ctrl+";
  const modAlt = isMac ? "⌘⌥" : "Ctrl+Alt+";

  const selectClone = (clone: HTMLElement | null) => {
    if (clone) {
      selectElementDirectly(clone);
      onElementSelected(clone);
    }
  };

  return [
    {
      label: "Edit text",
      shortcut: "Enter",
      action: () => onElementDoubleClick(el, new MouseEvent("dblclick")),
    },
    {
      label: "Add comment",
      action: () => openCommentPopoverForSelection(),
    },
    "separator",
    { label: "Copy", shortcut: `${mod}C`, action: () => copyElement(el) },
    {
      label: "Paste",
      shortcut: `${mod}V`,
      disabled: !hasCopiedElement(),
      action: () => selectClone(pasteElement(el)),
    },
    { label: "Copy style", shortcut: `${modAlt}C`, action: () => copyStyles(el) },
    {
      label: "Paste style",
      shortcut: `${modAlt}V`,
      disabled: !hasCopiedStyles(),
      action: () => {
        // Restyle the whole multi-selection, like panel edits do
        for (const t of collectSelectedElements(el)) {
          pasteStyles(t);
        }
        refreshSelection();
        sendElementData(el);
      },
    },
    {
      label: "Duplicate",
      shortcut: `${mod}D`,
      action: () => selectClone(duplicateSelectedElements(el)),
    },
    "separator",
    {
      label: "Select parent",
      shortcut: "Esc",
      disabled:
        !el.parentElement ||
        el.parentElement === document.body ||
        el.parentElement === document.documentElement,
      action: () => {
        const parent = el.parentElement;
        if (parent) {
          selectElementDirectly(parent);
          onElementSelected(parent);
        }
      },
    },
    {
      label: "Add container",
      shortcut: `${mod}G`,
      action: () => {
        const wrapper = wrapElementsInGroup(collectSelectedElements(el));
        if (wrapper) {
          selectElementDirectly(wrapper);
          onElementSelected(wrapper);
        }
      },
    },
    "separator",
    {
      label: "Hide",
      shortcut: isMac ? "⇧⌘H" : "Shift+Ctrl+H",
      action: () => hideSelectedElements(el),
    },
    {
      label: "Delete",
      shortcut: "Del",
      action: () => {
        deleteSelectedElements(el);
        clearSelection();
      },
    },
  ];
}

/**
 * Hide the whole selection (primary + multi-selected) as one undoable batch.
 * Shared by the Shift+Cmd+H shortcut and the context menu.
 */
function hideSelectedElements(primary: HTMLElement): void {
  const targets = collectSelectedElements(primary);
  const batched = targets.length > 1;
  if (batched) startBatch();
  for (const t of targets) {
    const prevDisplay = window.getComputedStyle(t).display;
    t.style.setProperty("display", "none", "important");
    recordHideChange(t, prevDisplay);
  }
  if (batched) endBatch();
  clearSelection();
}

/**
 * Duplicate the whole selection as one undoable batch; returns the clone of
 * the primary so the caller can move selection onto it.
 */
function duplicateSelectedElements(primary: HTMLElement): HTMLElement | null {
  const targets = collectSelectedElements(primary);
  const batched = targets.length > 1;
  if (batched) startBatch();
  let primaryClone: HTMLElement | null = null;
  for (const t of targets) {
    const clone = duplicateElement(t);
    if (t === primary) primaryClone = clone;
  }
  if (batched) endBatch();
  return primaryClone;
}

// --- Comment popover helpers ---

function buildCommentContextLabel(element: Element): string {
  const data = extractElementData(element);
  const component = data.componentInfo?.componentName;
  const tag = data.tag;
  // Short text preview for context
  const text = element.textContent?.trim().replace(/\s+/g, " ") ?? "";
  const textPreview = text.length > 40 ? text.slice(0, 40) + "\u2026" : text;
  const base = component ? `<${component}> ${tag}` : `<${tag}>`;
  return textPreview ? `${base} "${textPreview}"` : base;
}

function openCommentPopoverForSelection(): void {
  if (isPopoverOpen()) {
    closeCommentPopover();
    return;
  }
  const el = getSelectedElement();
  if (!el) return;
  suspendPicker();
  openCommentPopover({
    anchorRect: el.getBoundingClientRect(),
    contextLabel: buildCommentContextLabel(el),
    onSave: (text) => {
      recordCommentChange(el, text);
    },
    onClose: () => {
      resumePicker();
    },
  });
}

function openCommentPopoverForPin(changeId: string): void {
  const comments = getComments();
  const existing = comments.find((c) => c.id === changeId);
  if (!existing) return;
  let target: Element | null = null;
  try {
    target = document.querySelector(existing.selector);
  } catch {
    target = null;
  }
  const anchorRect = target
    ? target.getBoundingClientRect()
    : new DOMRect(window.innerWidth / 2, window.innerHeight / 3, 0, 0);
  suspendPicker();
  openCommentPopover({
    anchorRect,
    contextLabel: target
      ? buildCommentContextLabel(target)
      : existing.selector,
    existing,
    onUpdate: (text) => {
      updateCommentChange(changeId, text);
    },
    onDelete: () => {
      deleteCommentChange(changeId);
    },
    onClose: () => {
      resumePicker();
    },
  });
}

// --- Helpers ---

function sendElementData(element: Element): void {
  const data = extractElementData(element);
  safeSendMessage({
    type: "ELEMENT_SELECTED",
    data,
  } satisfies Message);

  // With a live multi-selection, follow up with the merged view so the panel
  // keeps its "Mixed" placeholders and N-selected badge after every edit —
  // a plain ELEMENT_SELECTED alone would flip it to single-select while the
  // content script keeps fanning edits out to the whole selection.
  const multiEls = getMultiSelectedElements();
  if (multiEls.length > 1 && multiEls.includes(element)) {
    safeSendMessage({
      type: "MULTI_ELEMENT_SELECTED",
      count: multiEls.length,
      data: extractMergedElementData(multiEls, element),
    } satisfies Message);
  }
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

/**
 * Delete the selected element. When multi-edit ("Edit all matching") is on, all
 * matching instances are deleted too; when several elements are multi-selected,
 * all of them are deleted. Multiple deletions are grouped into a single batch so
 * one undo restores everything.
 */
function deleteSelectedElements(primary: HTMLElement): void {
  // Collect every element to delete, de-duplicated, starting with the primary.
  const targets = new Set<HTMLElement>();
  targets.add(primary);

  for (const el of getMultiSelectedElements()) {
    if (el instanceof HTMLElement) targets.add(el);
  }

  if (multiEditEnabled) {
    for (const match of findMatchingElements(primary)) {
      if (match instanceof HTMLElement) targets.add(match);
    }
  }

  const list = Array.from(targets);
  const batched = list.length > 1;
  if (batched) startBatch();

  for (const el of list) {
    const parent = el.parentElement;
    if (!parent) continue;
    // Compute the parent selector and index against the live DOM right before
    // removal so undo can re-insert each element at the correct position.
    const parentSelector = generateSelector(parent);
    const index = Array.from(parent.children).indexOf(el);
    recordDeleteChange(el, parentSelector, index);
    el.remove();
  }

  if (batched) endBatch();
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
