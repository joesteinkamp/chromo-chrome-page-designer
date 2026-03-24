import type { Change, ElementData } from "./types";

/** All messages passed between extension contexts */
export type Message =
  // Lifecycle
  | { type: "ACTIVATE" }
  | { type: "DEACTIVATE" }
  | { type: "GET_STATE" }
  | { type: "STATE_RESPONSE"; isActive: boolean }
  | { type: "OPEN_SIDE_PANEL" }
  // Element selection
  | { type: "ELEMENT_SELECTED"; data: ElementData }
  | { type: "ELEMENT_DESELECTED" }
  // Multi-edit
  | { type: "TOGGLE_MULTI_EDIT"; enabled: boolean }
  // Style changes (panel → content script)
  | { type: "APPLY_STYLE"; property: string; value: string }
  // Interaction events (content script → background → panel)
  | { type: "TEXT_CHANGED"; selector: string; from: string; to: string }
  | {
      type: "ELEMENT_MOVED";
      selector: string;
      fromParent: string;
      fromIndex: number;
      toParent: string;
      toIndex: number;
    }
  | {
      type: "ELEMENT_RESIZED";
      selector: string;
      from: { width: string; height: string };
      to: { width: string; height: string };
    }
  | { type: "IMAGE_REPLACED"; selector: string; from: string; to: string }
  // Change tracking
  | { type: "UNDO_CHANGE"; changeId: string }
  | { type: "UNDO_ALL" }
  | { type: "REDO" }
  | { type: "GET_CHANGES" }
  | { type: "CHANGES_RESPONSE"; changes: Change[]; canRedo: boolean }
  | { type: "CLEAR_CHANGES" }
  // AI
  | {
      type: "AI_REQUEST";
      prompt: string;
      elementHTML: string;
      computedStyles: Record<string, string>;
      selector: string;
    }
  | {
      type: "AI_RESPONSE";
      styleChanges: Array<{ property: string; value: string }>;
      textContent?: string;
      explanation: string;
    }
  | { type: "AI_ERROR"; error: string }
  | {
      type: "APPLY_AI_CHANGES";
      styleChanges: Array<{ property: string; value: string }>;
      textContent?: string;
    }
  | { type: "AI_CHANGES_APPLIED"; appliedCount: number }
  // Persistence
  | { type: "SAVE_EDITS"; url: string; changes: Change[] }
  | { type: "LOAD_EDITS"; url: string }
  | { type: "EDITS_LOADED"; changes: Change[] | null }
  | { type: "CHECK_SAVED_EDITS"; url: string }
  | { type: "SAVED_EDITS_AVAILABLE"; url: string }
  | { type: "REPLAY_CHANGES"; changes: Change[] }
  | { type: "REPLAY_RESULT"; applied: number; failed: number }
  // Screenshot
  | { type: "CAPTURE_SCREENSHOT" }
  | { type: "SCREENSHOT_CAPTURED"; dataUrl: string };

/** Type-safe message sender to background */
export function sendMessage(message: Message): Promise<Message | undefined> {
  return chrome.runtime.sendMessage(message);
}

/** Type-safe message sender to a specific tab's content script */
export function sendTabMessage(
  tabId: number,
  message: Message
): Promise<Message | undefined> {
  return chrome.tabs.sendMessage(tabId, message);
}
