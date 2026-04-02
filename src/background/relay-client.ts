/**
 * WebSocket relay client for connecting the extension to an external relay server.
 * Runs in the background service worker.
 * The relay server bridges the extension to MCP clients (AI coding agents).
 */

import type { Change, ElementData } from "../shared/types";
import type { ComponentContext } from "../shared/export";

export interface RelayStateUpdate {
  pageUrl: string;
  pageTitle: string;
  selectedElement: ElementData | null;
  changes: Change[];
  componentMap: Record<string, ComponentContext>;
}

export interface RelayCommand {
  type: "apply_style" | "apply_text" | "select_element" | "get_state";
  [key: string]: any;
}

// --- Internal state ---

let ws: WebSocket | null = null;
let userId: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let connected = false;
let intentionallyStopped = false;
let commandHandler: ((cmd: RelayCommand) => void) | null = null;
let connectionListeners: Array<(connected: boolean) => void> = [];

const MAX_RECONNECT_DELAY = 8000;
const PING_INTERVAL = 30_000;
const DEFAULT_RELAY_URL = "ws://localhost:3847";

// --- Public API ---

/** Start the relay connection */
export async function initRelay(): Promise<void> {
  intentionallyStopped = false;
  const id = await getUserId();
  const baseUrl = await getRelayBaseUrl();
  connect(`${baseUrl}/ws?id=${id}`);
}

/** Stop the relay connection */
export async function stopRelay(): Promise<void> {
  intentionallyStopped = true;
  cleanup();
}

/** Whether the relay WebSocket is currently connected */
export function isRelayConnected(): boolean {
  return connected;
}

/** Returns the MCP endpoint URL that AI agents should connect to */
export async function getRelayEndpoint(): Promise<string> {
  const id = await getUserId();
  const baseUrl = await getRelayBaseUrl();
  // Convert ws:// to http:// for the MCP endpoint
  const httpBase = baseUrl.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://");
  return `${httpBase}/mcp/${id}`;
}

/** Get or generate the stable user ID */
export async function getUserId(): Promise<string> {
  if (userId) return userId;

  const result = await chrome.storage.sync.get("relayUserId");
  if (result.relayUserId) {
    userId = result.relayUserId;
    return userId!;
  }

  // Generate 8-char alphanumeric ID
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  userId = id;
  await chrome.storage.sync.set({ relayUserId: id });
  return id;
}

/** Push a state update to the relay server */
export function pushStateUpdate(data: RelayStateUpdate): void {
  if (!connected || !ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify({ type: "state_update", ...data }));
  } catch {
    // WebSocket may have closed between the check and the send
  }
}

/** Register a handler for commands received from the relay */
export function onRelayCommand(handler: (cmd: RelayCommand) => void): void {
  commandHandler = handler;
}

/** Register a listener for connection status changes */
export function onConnectionChange(listener: (connected: boolean) => void): void {
  connectionListeners.push(listener);
}

// --- Internal ---

async function getRelayBaseUrl(): Promise<string> {
  const result = await chrome.storage.sync.get("relayUrl");
  return result.relayUrl || DEFAULT_RELAY_URL;
}

function connect(url: string): void {
  cleanup();

  try {
    ws = new WebSocket(url);
  } catch (err) {
    console.warn("Page Designer relay: WebSocket creation failed:", err);
    scheduleReconnect(url);
    return;
  }

  ws.onopen = () => {
    connected = true;
    reconnectDelay = 1000; // Reset backoff on success
    notifyConnectionChange(true);

    // Start keepalive ping
    pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "ping" }));
        } catch {
          // ignore
        }
      }
    }, PING_INTERVAL);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "pong") return; // Ignore pong responses

      if (commandHandler && data.type) {
        commandHandler(data as RelayCommand);
      }
    } catch {
      console.warn("Page Designer relay: Failed to parse message:", event.data);
    }
  };

  ws.onclose = () => {
    const wasConnected = connected;
    connected = false;
    if (wasConnected) {
      notifyConnectionChange(false);
    }
    if (!intentionallyStopped) {
      scheduleReconnect(url);
    }
  };

  ws.onerror = () => {
    // onclose will fire after onerror, so reconnect logic is handled there
  };
}

function cleanup(): void {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    try {
      ws.onclose = null; // Prevent reconnect on intentional close
      ws.onerror = null;
      ws.onmessage = null;
      ws.onopen = null;
      ws.close();
    } catch {
      // ignore
    }
    ws = null;
  }
  if (connected) {
    connected = false;
    notifyConnectionChange(false);
  }
}

function scheduleReconnect(url: string): void {
  if (intentionallyStopped) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect(url);
  }, reconnectDelay);

  // Exponential backoff: 1s, 2s, 4s, 8s max
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
}

function notifyConnectionChange(isConnected: boolean): void {
  for (const listener of connectionListeners) {
    try {
      listener(isConnected);
    } catch {
      // ignore listener errors
    }
  }
}
