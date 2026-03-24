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
