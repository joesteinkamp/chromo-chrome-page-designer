/**
 * Background service worker.
 * Relays messages between content script and side panel.
 * Handles AI API calls, storage, and screenshots.
 */

import type { Message } from "../shared/messages";
import { processAIRequest } from "./ai-client";
import { saveEdits, loadEdits, hasSavedEdits } from "./storage";
import { captureScreenshot } from "./screenshot";

let activeTabId: number | null = null;

// --- Message handling ---

chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    // Track the active tab from content script messages
    if (sender.tab?.id) {
      activeTabId = sender.tab.id;
    }

    switch (message.type) {
      // --- Lifecycle ---
      case "OPEN_SIDE_PANEL":
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          const tab = tabs[0];
          if (tab?.id) {
            await chrome.sidePanel.open({ tabId: tab.id });
            activeTabId = tab.id;
            chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE" } satisfies Message);
          }
        });
        break;

      // --- Forward to content script ---
      case "ACTIVATE":
      case "DEACTIVATE":
      case "APPLY_STYLE":
      case "UNDO_CHANGE":
      case "UNDO_ALL":
      case "CLEAR_CHANGES":
        forwardToContentScript(message);
        break;

      case "GET_STATE":
      case "GET_CHANGES":
        forwardToContentScript(message, sendResponse);
        return true; // async

      // --- Forward to panel (from content script) ---
      case "ELEMENT_SELECTED":
      case "ELEMENT_DESELECTED":
      case "CHANGES_RESPONSE":
      case "STATE_RESPONSE":
      case "SAVED_EDITS_AVAILABLE":
        // These broadcast on the runtime channel — panel picks them up
        break;

      // --- AI ---
      case "AI_REQUEST":
        handleAIRequest(message);
        break;

      case "APPLY_AI_CHANGES":
        forwardToContentScript(message, sendResponse);
        return true;

      // --- Persistence ---
      case "SAVE_EDITS":
        saveEdits(message.url, message.changes).then(() => {
          sendResponse({ type: "STATE_RESPONSE", isActive: true });
        });
        return true;

      case "LOAD_EDITS":
        loadEdits(message.url).then((changes) => {
          sendResponse({ type: "EDITS_LOADED", changes } satisfies Message);
        });
        return true;

      case "CHECK_SAVED_EDITS":
        hasSavedEdits(message.url).then((has) => {
          sendResponse({ hasSavedEdits: has });
        });
        return true;

      case "REPLAY_CHANGES":
        forwardToContentScript(message, sendResponse);
        return true;

      // --- Screenshot ---
      case "CAPTURE_SCREENSHOT":
        captureScreenshot()
          .then((dataUrl) => {
            sendResponse({ type: "SCREENSHOT_CAPTURED", dataUrl } satisfies Message);
          })
          .catch((err) => {
            sendResponse({ type: "AI_ERROR", error: err.message } as Message);
          });
        return true;
    }
  }
);

// --- AI request handler ---

async function handleAIRequest(message: Extract<Message, { type: "AI_REQUEST" }>): Promise<void> {
  try {
    const result = await processAIRequest({
      prompt: message.prompt,
      elementHTML: message.elementHTML,
      computedStyles: message.computedStyles,
      selector: message.selector,
    });

    // Send AI response to panel
    chrome.runtime.sendMessage({
      type: "AI_RESPONSE",
      styleChanges: result.styleChanges,
      textContent: result.textContent,
      explanation: result.explanation,
    } satisfies Message);
  } catch (err: any) {
    chrome.runtime.sendMessage({
      type: "AI_ERROR",
      error: err.message || "Unknown AI error",
    } satisfies Message);
  }
}

// --- Helpers ---

function forwardToContentScript(message: Message, sendResponse?: (resp: any) => void): void {
  const tabId = activeTabId;
  if (!tabId) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id) {
        activeTabId = tab.id;
        if (sendResponse) {
          chrome.tabs.sendMessage(tab.id, message, sendResponse);
        } else {
          chrome.tabs.sendMessage(tab.id, message);
        }
      }
    });
    return;
  }

  if (sendResponse) {
    chrome.tabs.sendMessage(tabId, message, sendResponse);
  } else {
    chrome.tabs.sendMessage(tabId, message);
  }
}

// Track active tab
chrome.tabs.onActivated.addListener((info) => {
  activeTabId = info.tabId;
});

// Open side panel on action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});
