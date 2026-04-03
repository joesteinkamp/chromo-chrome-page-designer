/**
 * Background service worker.
 * Relays messages between content script and side panel.
 * Handles AI API calls, storage, and screenshots.
 */

import type { Message } from "../shared/messages";
import { saveEdits, loadEdits, hasSavedEdits } from "./storage";
import { captureScreenshot } from "./screenshot";

let activeTabId: number | null = null;
/** Tabs where the extension has been activated (content script should be running) */
const activatedTabs = new Set<number>();
/** Tabs currently being injected (prevents concurrent injection races) */
const injectingTabs = new Set<number>();

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
            const injected = await ensureContentScript(tab.id);
            if (injected) {
              activatedTabs.add(tab.id);
              sendToTab(tab.id, { type: "ACTIVATE" });
            } else {
              chrome.runtime.sendMessage({ type: "INJECTION_FAILED" } satisfies Message).catch(() => {});
            }
          }
        });
        break;

      case "ACTIVATE":
        // From side panel — ensure content script is injected, then activate
        getActiveTabId().then(async (tabId) => {
          if (!tabId) return;
          const injected = await ensureContentScript(tabId);
          if (!injected) {
            // Notify panel that injection failed (e.g. activeTab permission expired)
            chrome.runtime.sendMessage({ type: "INJECTION_FAILED" } satisfies Message).catch(() => {});
            return;
          }
          activatedTabs.add(tabId);
          // Use sendMessage with callback to ensure delivery
          chrome.tabs.sendMessage(tabId, message, (resp) => {
            void chrome.runtime.lastError;
            // Forward the STATE_RESPONSE to the panel if we got one
            if (resp?.type === "STATE_RESPONSE") {
              try {
                chrome.runtime.sendMessage(resp);
              } catch { /* panel may not be open */ }
            }
          });
        });
        break;

      // --- Forward to content script ---
      case "DEACTIVATE":
        getActiveTabId().then((tabId) => {
          if (tabId) activatedTabs.delete(tabId);
        });
        forwardToContentScript(message);
        break;
      case "TOGGLE_MULTI_EDIT":
      case "APPLY_STYLE":
      case "APPLY_STYLE_TO_MATCHING":
      case "APPLY_PROP":
      case "UNDO_CHANGE":
      case "UNDO_ALL":
      case "REDO":
      case "REDO_CHANGE":
      case "CLEAR_CHANGES":
      case "SELECT_ELEMENT":
      case "WRAP_ELEMENT":
      case "FORCE_PSEUDO_STATE":
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
      // Only re-broadcast messages from content scripts (which have sender.tab)
      // to ensure the side panel receives them
      case "ELEMENT_SELECTED":
      case "ELEMENT_DESELECTED":
      case "MULTI_ELEMENT_SELECTED":
      case "CHANGES_RESPONSE":
      case "STATE_RESPONSE":
      case "SAVED_EDITS_AVAILABLE":
        if (sender.tab) {
          chrome.runtime.sendMessage(message).catch(() => {});
        }
        break;

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
            sendResponse({ error: err.message });
          });
        return true;
    }
  }
);

// --- Content script injection ---

/**
 * Ensure the content script is loaded on the given tab.
 * Uses chrome.scripting.executeScript to inject programmatically.
 * Requires either activeTab permission (from user gesture) or host_permissions.
 * Returns true if the content script is available, false on failure.
 */
async function ensureContentScript(tabId: number): Promise<boolean> {
  // Prevent concurrent injection attempts for the same tab
  if (injectingTabs.has(tabId)) return true;

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
    return true;
  } catch {
    // Content script not loaded — inject it
    injectingTabs.add(tabId);
    try {
      // Inject main world bridge first (for framework detection)
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content/main-world-bridge.js"],
        world: "MAIN" as any,
      });
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
      return true;
    } catch (err) {
      // Can't inject — no permission or restricted page (chrome://, etc.)
      console.warn("Chromo Design: Cannot inject into this tab:", err);
      return false;
    } finally {
      injectingTabs.delete(tabId);
    }
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
          console.warn("Chromo Design:", chrome.runtime.lastError.message);
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

// Re-inject content script when a previously activated tab navigates.
// Only act on actual navigations (url change), not every tab update event.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url && activatedTabs.has(tabId)) {
    // URL changed — the old content script is gone. Wait for page to load,
    // then re-inject. We listen for the next "complete" status.
    const onComplete = (_tid: number, info: any) => {
      if (_tid === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(onComplete);
        ensureContentScript(tabId).then((injected) => {
          if (injected) {
            sendToTab(tabId, { type: "ACTIVATE" });
          } else {
            activatedTabs.delete(tabId);
            chrome.runtime.sendMessage({ type: "INJECTION_FAILED" } satisfies Message).catch(() => {});
          }
        });
      }
    };
    chrome.tabs.onUpdated.addListener(onComplete);
  }
});

// Clean up when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  activatedTabs.delete(tabId);
  if (activeTabId === tabId) activeTabId = null;
});

// Open side panel on action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});

// Context menu — "Design this Page"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "design-this-page",
    title: "Design this Page",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "design-this-page" && tab?.id) {
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }
});

// Detect side panel close via port disconnect and deactivate content script
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "side-panel") {
    port.onDisconnect.addListener(() => {
      // Panel was closed — deactivate the content script and stop tracking
      forwardToContentScript({ type: "DEACTIVATE" } as any);
      activatedTabs.clear();
    });
  }
});
