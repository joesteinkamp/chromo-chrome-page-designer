import { useEffect, useState } from "react";
import type { ElementData } from "../../shared/types";
import type { Message } from "../../shared/messages";

export function useElementData() {
  const [elementData, setElementData] = useState<ElementData | null>(null);
  const [isConnected, setIsConnected] = useState(false);

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
          break;
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    // Activate on initial panel open
    chrome.runtime.sendMessage({ type: "ACTIVATE" } satisfies Message);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  return { elementData, isConnected, setElementData };
}
