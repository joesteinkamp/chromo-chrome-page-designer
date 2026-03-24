import type { Change, ElementData } from "./types";

/** All messages passed between extension contexts */
export type Message =
  | { type: "ACTIVATE" }
  | { type: "DEACTIVATE" }
  | { type: "GET_STATE" }
  | { type: "STATE_RESPONSE"; isActive: boolean }
  | { type: "ELEMENT_SELECTED"; data: ElementData }
  | { type: "ELEMENT_DESELECTED" }
  | { type: "APPLY_STYLE"; property: string; value: string }
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
  | { type: "UNDO_CHANGE"; changeId: string }
  | { type: "GET_CHANGES" }
  | { type: "CHANGES_RESPONSE"; changes: Change[] }
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
  | { type: "SAVE_EDITS"; url: string; changes: Change[] }
  | { type: "LOAD_EDITS"; url: string }
  | { type: "EDITS_LOADED"; changes: Change[] | null }
  | { type: "CAPTURE_SCREENSHOT" }
  | { type: "SCREENSHOT_CAPTURED"; dataUrl: string }
  | { type: "OPEN_SIDE_PANEL" };

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
