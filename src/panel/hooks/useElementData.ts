import { useEffect, useState, useRef } from "react";
import type { ElementData } from "../../shared/types";
import type { Message } from "../../shared/messages";

export function useElementData() {
  const [elementData, setElementData] = useState<ElementData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const activateRetries = useRef(0);

  useEffect(() => {
    const listener = (message: Message) => {
      switch (message.type) {
        case "ELEMENT_SELECTED":
          setElementData(message.data);
          setIsConnected(true);
          break;
        case "ELEMENT_DESELECTED":
          setElementData(null);
          break;
        case "STATE_RESPONSE":
          setIsConnected(message.isActive);
          // If not active yet and we haven't retried too many times, try again
          if (!message.isActive && activateRetries.current < 3) {
            activateRetries.current++;
            setTimeout(() => {
              chrome.runtime.sendMessage({ type: "ACTIVATE" } satisfies Message);
            }, 500);
          }
          break;
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    // Activate the content script when side panel opens
    chrome.runtime.sendMessage({ type: "ACTIVATE" } satisfies Message);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  return { elementData, isConnected };
}
