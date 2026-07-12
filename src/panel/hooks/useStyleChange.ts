import { useCallback } from "react";
import type { Message } from "../../shared/messages";

/**
 * Hook that returns a function to send style changes to the content script.
 * The content script applies the change and sends back updated element data.
 */
export function useStyleChange() {
  const sendStyleChange = useCallback(
    (property: string, value: string) => {
      chrome.runtime.sendMessage({
        type: "APPLY_STYLE",
        property,
        value,
      } satisfies Message);
    },
    []
  );

  return sendStyleChange;
}

/**
 * Like useStyleChange but applies several properties as ONE undoable batch —
 * used for gestures that must revert atomically (aspect-locked W+H).
 */
export function useStyleBatch() {
  const sendStyleBatch = useCallback(
    (changes: Array<{ property: string; value: string }>) => {
      chrome.runtime.sendMessage({
        type: "APPLY_STYLES",
        changes,
      } satisfies Message);
    },
    []
  );

  return sendStyleBatch;
}
