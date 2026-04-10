import { useEffect, useState, useRef } from "react";
import type { ElementData } from "../../shared/types";
import type { Message } from "../../shared/messages";

export function useElementData() {
  const [elementData, setElementData] = useState<ElementData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [multiSelectCount, setMultiSelectCount] = useState(0);
  const activateRetries = useRef(0);

  useEffect(() => {
    const listener = (message: Message) => {
      switch (message.type) {
        case "ELEMENT_SELECTED":
          setElementData(message.data);
          setIsConnected(true);
          setMultiSelectCount(0);
          break;
        case "MULTI_ELEMENT_SELECTED":
          setElementData(message.data);
          setIsConnected(true);
          setMultiSelectCount(message.count);
          break;
        case "ELEMENT_DESELECTED":
          setElementData(null);
          setMultiSelectCount(0);
          break;
        case "STATE_RESPONSE":
          setIsConnected(message.isActive);
          break;
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    // Open a long-lived port so the service worker can detect panel close.
    // If the service worker restarts (MV3 lifecycle), the port breaks silently.
    // We must reconnect so the SW can still detect when the panel actually closes.
    let port = chrome.runtime.connect({ name: "side-panel" });
    const reconnectPort = () => {
      try {
        port = chrome.runtime.connect({ name: "side-panel" });
        port.onDisconnect.addListener(reconnectPort);
      } catch {
        // Extension context invalidated — panel is actually closing
      }
    };
    port.onDisconnect.addListener(reconnectPort);

    // Activate on initial panel open
    chrome.runtime.sendMessage({ type: "ACTIVATE" } satisfies Message);

    // Also send deactivate on beforeunload (more reliable than React cleanup)
    const onUnload = () => {
      chrome.runtime.sendMessage({ type: "DEACTIVATE" } satisfies Message).catch(() => {});
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      window.removeEventListener("beforeunload", onUnload);
      port.onDisconnect.removeListener(reconnectPort);
      port.disconnect();
      chrome.runtime.sendMessage({ type: "DEACTIVATE" } satisfies Message).catch(() => {});
    };
  }, []);

  return { elementData, isConnected, setElementData, multiSelectCount };
}
