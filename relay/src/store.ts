import type { ServerResponse } from "node:http";
import type { WebSocket } from "ws";

export interface ElementData {
  selector: string;
  tagName: string;
  classes: string[];
  id: string;
  computedStyles: Record<string, string>;
  breadcrumb: string[];
  component?: {
    framework: string;
    name: string;
    sourceFile?: string;
    sourceLine?: number;
  };
  designTokens?: Record<string, string>;
}

export interface Change {
  id: string;
  type: "style" | "text" | "attribute";
  selector: string;
  property: string;
  fromValue: string;
  toValue: string;
  timestamp: number;
  resolved: boolean;
  component?: {
    framework: string;
    name: string;
    sourceFile?: string;
    sourceLine?: number;
  };
}

export interface UserState {
  wsConnection: WebSocket | null;
  pageUrl: string;
  pageTitle: string;
  selectedElement: ElementData | null;
  changes: Change[];
  componentMap: Record<string, any>;
  sseClients: Set<ServerResponse>;
  lastActivity: number;
}

const store = new Map<string, UserState>();

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

export function getOrCreateUser(userId: string): UserState {
  let state = store.get(userId);
  if (!state) {
    state = {
      wsConnection: null,
      pageUrl: "",
      pageTitle: "",
      selectedElement: null,
      changes: [],
      componentMap: {},
      sseClients: new Set(),
      lastActivity: Date.now(),
    };
    store.set(userId, state);
  }
  state.lastActivity = Date.now();
  return state;
}

export function getUser(userId: string): UserState | undefined {
  return store.get(userId);
}

export function touchUser(userId: string): void {
  const state = store.get(userId);
  if (state) {
    state.lastActivity = Date.now();
  }
}

export function removeUser(userId: string): void {
  const state = store.get(userId);
  if (state) {
    // Close all SSE clients
    for (const res of state.sseClients) {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
    state.sseClients.clear();
    store.delete(userId);
  }
}

export function broadcastToSSE(userId: string, event: string, data: unknown): void {
  const state = store.get(userId);
  if (!state) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const dead: ServerResponse[] = [];

  for (const client of state.sseClients) {
    try {
      if (!client.writableEnded) {
        client.write(payload);
      } else {
        dead.push(client);
      }
    } catch {
      dead.push(client);
    }
  }

  for (const client of dead) {
    state.sseClients.delete(client);
  }
}

export function cleanupInactiveUsers(): void {
  const now = Date.now();
  for (const [userId, state] of store) {
    if (now - state.lastActivity > INACTIVITY_TIMEOUT_MS) {
      console.log(`[store] Cleaning up inactive user: ${userId}`);
      // Close WebSocket if still open
      if (state.wsConnection) {
        try {
          state.wsConnection.close(1000, "Inactivity timeout");
        } catch {
          // ignore
        }
      }
      removeUser(userId);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupInactiveUsers, 10 * 60 * 1000);
