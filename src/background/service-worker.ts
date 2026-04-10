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
  onConnectionChange,
} from "./relay-client";
import type { RelayCommand } from "./relay-client";

let activeTabId: number | null = null;
/** The frame ID that currently has a selected element (0 = top frame) */
let activeFrameId: number = 0;
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

    // Track the frame that has the active selection
    if (sender.tab?.id && sender.frameId !== undefined) {
      if (message.type === "ELEMENT_SELECTED") {
        const prevFrameId = activeFrameId;
        activeFrameId = sender.frameId;
        // Deselect in other frames when a new frame gets a selection
        if (prevFrameId !== activeFrameId) {
          deselectOtherFrames(sender.tab.id, sender.frameId);
        }
      } else if (message.type === "ELEMENT_DESELECTED" && sender.frameId === activeFrameId) {
        activeFrameId = 0;
      }
    }

    switch (message.type) {
      // --- Navigation ---
      case "OPEN_OPTIONS_PAGE":
        chrome.runtime.openOptionsPage();
        break;

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
          // Annotate element data with frameId so the panel knows which frame it came from
          if (message.type === "ELEMENT_SELECTED" && sender.frameId) {
            message.data.frameId = sender.frameId;
          }
          if (message.type === "MULTI_ELEMENT_SELECTED" && sender.frameId) {
            message.data.frameId = sender.frameId;
          }
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
          const status: Message = {
            type: "AGENT_SYNC_STATUS",
            enabled: true,
            status: isRelayConnected() ? "connected" : "connecting",
            endpoint,
            userId: id,
          };
          chrome.runtime.sendMessage(status).catch(() => {});
        });
        break;

      case "AGENT_SYNC_DISABLE":
        stopRelay().then(async () => {
          const endpoint = await getRelayEndpoint();
          const id = await getUserId();
          const status: Message = {
            type: "AGENT_SYNC_STATUS",
            enabled: false,
            status: "disconnected",
            endpoint,
            userId: id,
          };
          chrome.runtime.sendMessage(status).catch(() => {});
        });
        break;

      case "GET_AGENT_SYNC_STATUS":
        (async () => {
          const endpoint = await getRelayEndpoint();
          const id = await getUserId();
          const status: Message = {
            type: "AGENT_SYNC_STATUS",
            enabled: isRelayConnected(),
            status: isRelayConnected() ? "connected" : "disconnected",
            endpoint,
            userId: id,
          };
          chrome.runtime.sendMessage(status).catch(() => {});
        })();
        break;

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
        runDesignCritique(message.apiKey, message.pageUrl, message.screenshotDataUrl, message.provider)
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
        runNLEdit(message.apiKey, message.instruction, message.selector, message.computedStyles, message.provider)
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
        target: { tabId, allFrames: true },
        files: ["content/main-world-bridge.js"],
        world: "MAIN" as any,
      });
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ["content/main.js"],
      });
      await chrome.scripting.insertCSS({
        target: { tabId, allFrames: true },
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
    // Route to the specific frame that has the active selection
    const options = activeFrameId ? { frameId: activeFrameId } : undefined;
    if (sendResponse) {
      chrome.tabs.sendMessage(tabId, message, options ?? {}, (resp) => {
        // Clear lastError to prevent unchecked error
        if (chrome.runtime.lastError) {
          console.warn("Chromo Design:", chrome.runtime.lastError.message);
        }
        sendResponse(resp);
      });
    } else {
      if (options) {
        chrome.tabs.sendMessage(tabId, message, options, () => {
          void chrome.runtime.lastError;
        });
      } else {
        sendToTab(tabId, message);
      }
    }
  });
}

/** Deselect elements in all frames except the specified one */
function deselectOtherFrames(tabId: number, exceptFrameId: number): void {
  chrome.webNavigation.getAllFrames({ tabId }, (frames) => {
    if (!frames) return;
    for (const frame of frames) {
      if (frame.frameId !== exceptFrameId) {
        chrome.tabs.sendMessage(
          tabId,
          { type: "DESELECT_FRAME" } satisfies Message,
          { frameId: frame.frameId },
          () => { void chrome.runtime.lastError; }
        );
      }
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

// --- Relay connection status ---
// Broadcast connection changes to the panel so the UI updates
onConnectionChange(async (connected) => {
  const endpoint = await getRelayEndpoint();
  const id = await getUserId();
  chrome.runtime.sendMessage({
    type: "AGENT_SYNC_STATUS",
    enabled: true,
    status: connected ? "connected" : "disconnected",
    endpoint,
    userId: id,
  } satisfies Message).catch(() => {});
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
        // Small delay to ensure element is selected before applying text
        setTimeout(() => {
          if (tabId) {
            sendToTab(tabId, {
              type: "APPLY_TEXT",
              selector: cmd.selector,
              text: cmd.text,
            } as Message);
          }
        }, 50);
      });
      break;

    case "get_element_styles":
      // Select the element — this triggers ELEMENT_SELECTED with full computed
      // styles, which the service worker already pushes to the relay
      getActiveTabId().then((tabId) => {
        if (!tabId) return;
        sendToTab(tabId, { type: "SELECT_ELEMENT", selector: cmd.selector } as Message);
      });
      break;
  }
});

// Detect side panel close via port disconnect and deactivate content script.
// Uses sendToTab (not forwardToContentScript) so the message reaches ALL frames,
// not just the activeFrameId. Also deactivates every tracked tab, not just the
// currently focused one.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "side-panel") {
    port.onDisconnect.addListener(() => {
      const deactivateMsg: Message = { type: "DEACTIVATE" };

      // Deactivate all tabs that were activated
      for (const tabId of activatedTabs) {
        sendToTab(tabId, deactivateMsg);
      }

      // Also send to the current active tab as a fallback (covers the case
      // where the service worker restarted and activatedTabs was lost)
      getActiveTabId().then((tabId) => {
        if (tabId && !activatedTabs.has(tabId)) {
          sendToTab(tabId, deactivateMsg);
        }
      });

      activatedTabs.clear();
      activeFrameId = 0;
    });
  }
});
