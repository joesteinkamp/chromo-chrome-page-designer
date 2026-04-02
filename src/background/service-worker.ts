/**
 * Background service worker.
 * Relays messages between content script and side panel.
 * Handles AI API calls, storage, and screenshots.
 */

import type { Message } from "../shared/messages";
import { saveEdits, loadEdits, hasSavedEdits } from "./storage";
import { captureScreenshot } from "./screenshot";
import { runDesignCritique, runNLEdit } from "./ai-service";
import {
  initRelay,
  stopRelay,
  isRelayConnected,
  getRelayEndpoint,
  getUserId,
  pushStateUpdate,
  onRelayCommand,
} from "./relay-client";
import type { RelayCommand } from "./relay-client";

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
        // From side panel — ensure content script is injected, then activate
        getActiveTabId().then(async (tabId) => {
          if (!tabId) return;
          await ensureContentScript(tabId);
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
        // Push to relay if connected
        if (isRelayConnected()) {
          if (message.type === "ELEMENT_SELECTED") {
            pushStateUpdate({
              pageUrl: sender.tab?.url || "",
              pageTitle: sender.tab?.title || "",
              selectedElement: message.data,
              changes: [],
              componentMap: {},
            });
          } else if (message.type === "CHANGES_RESPONSE") {
            pushStateUpdate({
              pageUrl: sender.tab?.url || "",
              pageTitle: sender.tab?.title || "",
              selectedElement: null,
              changes: message.changes,
              componentMap: {},
            });
          }
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

      // --- Agent Sync ---
      case "AGENT_SYNC_ENABLE":
        initRelay().then(async () => {
          const endpoint = await getRelayEndpoint();
          const id = await getUserId();
          sendResponse({
            type: "AGENT_SYNC_STATUS",
            enabled: true,
            status: isRelayConnected() ? "connected" : "connecting",
            endpoint,
            userId: id,
          } satisfies Message);
        });
        return true;

      case "AGENT_SYNC_DISABLE":
        stopRelay().then(async () => {
          const endpoint = await getRelayEndpoint();
          const id = await getUserId();
          sendResponse({
            type: "AGENT_SYNC_STATUS",
            enabled: false,
            status: "disconnected",
            endpoint,
            userId: id,
          } satisfies Message);
        });
        return true;

      case "GET_AGENT_SYNC_STATUS":
        (async () => {
          const endpoint = await getRelayEndpoint();
          const id = await getUserId();
          sendResponse({
            type: "AGENT_SYNC_STATUS",
            enabled: isRelayConnected(),
            status: isRelayConnected() ? "connected" : "disconnected",
            endpoint,
            userId: id,
          } satisfies Message);
        })();
        return true;

      // --- Relay commands (forwarded to content script) ---
      case "RELAY_APPLY_STYLE":
        forwardToContentScript({
          type: "APPLY_STYLE",
          property: message.property,
          value: message.value,
        } as Message);
        // Also select the element first if a selector is provided
        if (message.selector) {
          forwardToContentScript({
            type: "SELECT_ELEMENT",
            selector: message.selector,
          } as Message);
        }
        break;

      case "RELAY_APPLY_TEXT":
        forwardToContentScript({
          type: "SELECT_ELEMENT",
          selector: message.selector,
        } as Message);
        // Forward as TEXT_CHANGED so the content script can apply it
        if (sender.tab) {
          chrome.runtime.sendMessage(message).catch(() => {});
        }
        break;

      case "RELAY_SELECT_ELEMENT":
        forwardToContentScript({
          type: "SELECT_ELEMENT",
          selector: message.selector,
        } as Message);
        break;

      case "RELAY_GET_STATE":
        forwardToContentScript({ type: "GET_CHANGES" } as Message, sendResponse);
        return true;

      // --- AI features ---
      case "AI_CRITIQUE_REQUEST":
        runDesignCritique(message.apiKey, message.pageUrl, message.screenshotDataUrl)
          .then((suggestions) => {
            chrome.runtime.sendMessage({
              type: "AI_CRITIQUE_RESPONSE",
              suggestions,
            } satisfies Message).catch(() => {});
          })
          .catch((err) => {
            chrome.runtime.sendMessage({
              type: "AI_ERROR",
              error: err.message || "Design critique failed",
            } satisfies Message).catch(() => {});
          });
        break;

      case "AI_NL_EDIT_REQUEST":
        runNLEdit(message.apiKey, message.instruction, message.selector, message.computedStyles)
          .then((changes) => {
            chrome.runtime.sendMessage({
              type: "AI_NL_EDIT_RESPONSE",
              changes,
            } satisfies Message).catch(() => {});
          })
          .catch((err) => {
            chrome.runtime.sendMessage({
              type: "AI_ERROR",
              error: err.message || "Natural language edit failed",
            } satisfies Message).catch(() => {});
          });
        break;

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
    } catch (err) {
      // Can't inject on chrome:// pages, etc.
      console.warn("Chromo Design: Cannot inject into this tab:", err);
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

// --- Relay command handler ---
// Forward commands from the relay server to the content script
onRelayCommand((cmd: RelayCommand) => {
  switch (cmd.type) {
    case "apply_style":
      getActiveTabId().then((tabId) => {
        if (!tabId) return;
        if (cmd.selector) {
          sendToTab(tabId, { type: "SELECT_ELEMENT", selector: cmd.selector } as Message);
        }
        // Small delay to ensure element is selected before applying style
        setTimeout(() => {
          if (tabId) {
            sendToTab(tabId, {
              type: "APPLY_STYLE",
              property: cmd.property,
              value: cmd.value,
            } as Message);
          }
        }, 50);
      });
      break;

    case "apply_text":
      getActiveTabId().then((tabId) => {
        if (!tabId) return;
        if (cmd.selector) {
          sendToTab(tabId, { type: "SELECT_ELEMENT", selector: cmd.selector } as Message);
        }
      });
      break;

    case "select_element":
      getActiveTabId().then((tabId) => {
        if (!tabId) return;
        sendToTab(tabId, { type: "SELECT_ELEMENT", selector: cmd.selector } as Message);
      });
      break;

    case "get_state":
      getActiveTabId().then((tabId) => {
        if (!tabId) return;
        chrome.tabs.sendMessage(tabId, { type: "GET_CHANGES" } as Message, (resp) => {
          void chrome.runtime.lastError;
          if (resp && isRelayConnected()) {
            pushStateUpdate({
              pageUrl: "",
              pageTitle: "",
              selectedElement: null,
              changes: resp.changes || [],
              componentMap: {},
            });
          }
        });
      });
      break;
  }
});

// Detect side panel close via port disconnect and deactivate content script
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "side-panel") {
    port.onDisconnect.addListener(() => {
      // Panel was closed — deactivate the content script
      forwardToContentScript({ type: "DEACTIVATE" } as any);
    });
  }
});
