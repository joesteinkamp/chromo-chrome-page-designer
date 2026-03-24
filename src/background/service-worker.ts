/**
 * Background service worker.
 * Relays messages between content script and side panel.
 * Handles storage, AI API calls, and screenshots.
 */

import type { Message } from "../shared/messages";

// Track which tab the side panel is connected to
let activeTabId: number | null = null;

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
    activeTabId = tab.id;
    // Activate the content script
    chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE" } satisfies Message);
  }
});

// Message relay between content script ↔ side panel
chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    switch (message.type) {
      case "OPEN_SIDE_PANEL": {
        // From popup: open the side panel
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          const tab = tabs[0];
          if (tab?.id) {
            await chrome.sidePanel.open({ tabId: tab.id });
            activeTabId = tab.id;
            chrome.tabs.sendMessage(tab.id, {
              type: "ACTIVATE",
            } satisfies Message);
          }
        });
        break;
      }

      case "ACTIVATE":
      case "DEACTIVATE":
      case "APPLY_STYLE":
      case "UNDO_CHANGE": {
        // From side panel → forward to content script
        if (activeTabId) {
          chrome.tabs.sendMessage(activeTabId, message);
        } else {
          // Try the sender's tab or the active tab
          chrome.tabs.query(
            { active: true, currentWindow: true },
            (tabs) => {
              const tab = tabs[0];
              if (tab?.id) {
                activeTabId = tab.id;
                chrome.tabs.sendMessage(tab.id, message);
              }
            }
          );
        }
        break;
      }

      case "ELEMENT_SELECTED":
      case "ELEMENT_DESELECTED":
      case "CHANGES_RESPONSE":
      case "STATE_RESPONSE": {
        // From content script → broadcast (side panel will pick it up)
        // Track the tab that sent this
        if (sender.tab?.id) {
          activeTabId = sender.tab.id;
        }
        // Side panel listens on chrome.runtime.onMessage, so it'll receive this
        // No need to explicitly forward — the message is already on the runtime channel
        break;
      }

      case "GET_STATE": {
        // From side panel → forward to content script
        if (activeTabId) {
          chrome.tabs.sendMessage(
            activeTabId,
            message,
            (response: Message | undefined) => {
              if (response) {
                sendResponse(response);
              }
            }
          );
          return true; // Keep channel open for async response
        }
        break;
      }

      case "CAPTURE_SCREENSHOT": {
        chrome.tabs.captureVisibleTab(
          { format: "png" },
          (dataUrl) => {
            sendResponse({
              type: "SCREENSHOT_CAPTURED",
              dataUrl,
            } satisfies Message);
          }
        );
        return true; // Async response
      }
    }
  }
);

// Track active tab changes
chrome.tabs.onActivated.addListener((info) => {
  activeTabId = info.tabId;
});

// Set side panel behavior — open on action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {
    // Fallback for older Chrome versions
  });
