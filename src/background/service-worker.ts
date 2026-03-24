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
            await ensureContentScript(tab.id);
            sendToTab(tab.id, { type: "ACTIVATE" });
          }
        });
        break;

      case "ACTIVATE":
        // From side panel — ensure content script is injected first
        getActiveTabId().then(async (tabId) => {
          if (!tabId) return;
          await ensureContentScript(tabId);
          sendToTab(tabId, message);
        });
        break;

      // --- Forward to content script ---
      case "DEACTIVATE":
      case "APPLY_STYLE":
      case "UNDO_CHANGE":
      case "UNDO_ALL":
      case "CLEAR_CHANGES":
        forwardToContentScript(message);
        break;

      case "GET_STATE":
        // Try to forward — if content script isn't there, respond with inactive
        getActiveTabId().then(async (tabId) => {
          if (!tabId) {
            sendResponse({ type: "STATE_RESPONSE", isActive: false });
            return;
          }
          try {
            await ensureContentScript(tabId);
            chrome.tabs.sendMessage(tabId, message, (resp) => {
              if (chrome.runtime.lastError || !resp) {
                sendResponse({ type: "STATE_RESPONSE", isActive: false });
              } else {
                sendResponse(resp);
              }
            });
          } catch {
            sendResponse({ type: "STATE_RESPONSE", isActive: false });
          }
        });
        return true;

      case "GET_CHANGES":
        forwardToContentScript(message, sendResponse);
        return true;

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

// --- Content script injection ---

/**
 * Ensure the content script is loaded on the given tab.
 * After extension install/reload, existing tabs won't have it.
 * Uses chrome.scripting.executeScript to inject if needed.
 */
async function ensureContentScript(tabId: number): Promise<void> {
  try {
    // Check if content script is already there by sending a ping
    await new Promise<void>((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: "GET_STATE" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  } catch {
    // Content script not loaded — inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content/main.js"],
      });
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["content/content.css"],
      });
      // Give it a moment to initialize
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      // Can't inject on chrome:// pages, etc.
      console.warn("Page Designer: Cannot inject into this tab:", err);
    }
  }
}

// --- AI request handler ---

async function handleAIRequest(message: Extract<Message, { type: "AI_REQUEST" }>): Promise<void> {
  try {
    const result = await processAIRequest({
      prompt: message.prompt,
      elementHTML: message.elementHTML,
      computedStyles: message.computedStyles,
      selector: message.selector,
    });

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

async function getActiveTabId(): Promise<number | null> {
  if (activeTabId) return activeTabId;
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id ?? null;
      if (tabId) activeTabId = tabId;
      resolve(tabId);
    });
  });
}

/** Send a message to a tab, swallowing errors if content script isn't there */
function sendToTab(tabId: number, message: Message): void {
  chrome.tabs.sendMessage(tabId, message, () => {
    // Swallow "Receiving end does not exist" errors
    void chrome.runtime.lastError;
  });
}

function forwardToContentScript(message: Message, sendResponse?: (resp: any) => void): void {
  getActiveTabId().then((tabId) => {
    if (!tabId) return;
    if (sendResponse) {
      chrome.tabs.sendMessage(tabId, message, (resp) => {
        // Clear lastError to prevent unchecked error
        if (chrome.runtime.lastError) {
          console.warn("Page Designer:", chrome.runtime.lastError.message);
        }
        sendResponse(resp);
      });
    } else {
      sendToTab(tabId, message);
    }
  });
}

// Track active tab
chrome.tabs.onActivated.addListener((info) => {
  activeTabId = info.tabId;
});

// Open side panel on action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});
