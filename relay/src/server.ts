import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { getOrCreateUser, getUser, touchUser, broadcastToSSE } from "./store.js";
import { handleMcpRequest, getOrCreateSession, getSessionUserId } from "./mcp-handler.js";

const PORT = parseInt(process.env.PORT || "3847", 10);

// ── CORS helpers ───────────────────────────────────────────────────────────

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Mcp-Session-Id, Accept"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Mcp-Session-Id"
  );
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  setCorsHeaders(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// ── HTTP server ────────────────────────────────────────────────────────────

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  const method = req.method || "GET";

  // CORS preflight
  if (method === "OPTIONS") {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (pathname === "/health") {
    sendJson(res, 200, { status: "ok", timestamp: Date.now() });
    return;
  }

  // MCP endpoints: /mcp/{userId}
  const mcpMatch = pathname.match(/^\/mcp\/([a-zA-Z0-9_-]+)$/);
  if (mcpMatch) {
    const userId = mcpMatch[1];

    if (method === "GET") {
      handleMcpSSE(userId, req, res);
      return;
    }

    if (method === "POST") {
      handleMcpPost(userId, req, res);
      return;
    }

    if (method === "DELETE") {
      // Session termination
      setCorsHeaders(res);
      res.writeHead(200);
      res.end();
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  // 404
  sendJson(res, 404, { error: "Not found" });
});

// ── MCP POST handler ───────────────────────────────────────────────────────

function handleMcpPost(
  userId: string,
  req: IncomingMessage,
  res: ServerResponse
): void {
  let body = "";
  req.on("data", (chunk: Buffer) => {
    body += chunk.toString();
  });

  req.on("end", () => {
    let parsed: any;
    try {
      parsed = JSON.parse(body);
    } catch {
      sendJson(res, 400, {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: invalid JSON" },
      });
      return;
    }

    // Handle session
    const incomingSessionId = req.headers["mcp-session-id"] as string | undefined;
    const sessionId = getOrCreateSession(userId, incomingSessionId);

    // Handle batch requests
    if (Array.isArray(parsed)) {
      const results = parsed.map((rpcReq: any) =>
        handleMcpRequest(userId, rpcReq)
      );
      setCorsHeaders(res);
      res.setHeader("Mcp-Session-Id", sessionId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(results));
      return;
    }

    // Single request
    const result = handleMcpRequest(userId, parsed);

    // Notifications (no id) don't get a response body per JSON-RPC spec,
    // but we handle them gracefully
    if (parsed.id === undefined || parsed.id === null) {
      setCorsHeaders(res);
      res.setHeader("Mcp-Session-Id", sessionId);
      res.writeHead(204);
      res.end();
      return;
    }

    setCorsHeaders(res);
    res.setHeader("Mcp-Session-Id", sessionId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  });

  req.on("error", () => {
    sendJson(res, 500, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: "Internal error reading request body" },
    });
  });
}

// ── MCP SSE handler ────────────────────────────────────────────────────────

function handleMcpSSE(
  userId: string,
  _req: IncomingMessage,
  res: ServerResponse
): void {
  const state = getOrCreateUser(userId);

  setCorsHeaders(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

  state.sseClients.add(res);
  console.log(
    `[sse] Client connected for user ${userId} (total: ${state.sseClients.size})`
  );

  // Keep-alive ping every 30 seconds
  const keepAlive = setInterval(() => {
    try {
      if (!res.writableEnded) {
        res.write(`: keep-alive\n\n`);
      } else {
        clearInterval(keepAlive);
      }
    } catch {
      clearInterval(keepAlive);
    }
  }, 30_000);

  _req.on("close", () => {
    clearInterval(keepAlive);
    state.sseClients.delete(res);
    console.log(
      `[sse] Client disconnected for user ${userId} (total: ${state.sseClients.size})`
    );
  });
}

// ── WebSocket server ───────────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req: IncomingMessage, socket, head) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const userId = url.searchParams.get("id");
  if (!userId) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req, userId);
  });
});

wss.on("connection", (ws: WebSocket, _req: IncomingMessage, userId: string) => {
  const state = getOrCreateUser(userId);

  // If there's an existing connection, close it gracefully
  if (state.wsConnection && state.wsConnection.readyState === WebSocket.OPEN) {
    console.log(`[ws] Replacing existing connection for user ${userId}`);
    state.wsConnection.close(1000, "Replaced by new connection");
  }

  state.wsConnection = ws;
  console.log(`[ws] Extension connected for user ${userId}`);

  ws.on("message", (data: Buffer) => {
    let message: any;
    try {
      message = JSON.parse(data.toString());
    } catch {
      console.error(`[ws] Invalid JSON from user ${userId}`);
      return;
    }

    touchUser(userId);
    handleExtensionMessage(userId, state, message);
  });

  ws.on("close", (code: number, reason: Buffer) => {
    console.log(
      `[ws] Extension disconnected for user ${userId} (code: ${code}, reason: ${reason.toString()})`
    );
    if (state.wsConnection === ws) {
      state.wsConnection = null;
    }
  });

  ws.on("error", (err: Error) => {
    console.error(`[ws] Error for user ${userId}:`, err.message);
  });
});

// ── Extension message handling ─────────────────────────────────────────────

function handleExtensionMessage(
  userId: string,
  state: UserState,
  message: any
): void {
  switch (message.type) {
    case "state_update": {
      const data = message.data || {};

      if (data.pageUrl !== undefined) state.pageUrl = data.pageUrl;
      if (data.pageTitle !== undefined) state.pageTitle = data.pageTitle;
      if (data.selectedElement !== undefined)
        state.selectedElement = data.selectedElement;
      if (data.changes !== undefined) state.changes = data.changes;
      if (data.componentMap !== undefined)
        state.componentMap = data.componentMap;

      // Cache component info in componentMap if selectedElement has it
      if (data.selectedElement?.selector && data.selectedElement?.component) {
        state.componentMap[data.selectedElement.selector] = {
          ...state.componentMap[data.selectedElement.selector],
          component: data.selectedElement.component,
          computedStyles: data.selectedElement.computedStyles,
        };
      }

      broadcastToSSE(userId, "state_update", {
        pageUrl: state.pageUrl,
        pageTitle: state.pageTitle,
        selectedElement: state.selectedElement,
        changeCount: state.changes.length,
      });
      break;
    }

    case "element_styles_response": {
      // Response to a get_element_styles request
      const { selector, computedStyles } = message;
      if (selector && computedStyles) {
        state.componentMap[selector] = {
          ...state.componentMap[selector],
          computedStyles,
        };
      }
      break;
    }

    default: {
      console.log(`[ws] Unknown message type from user ${userId}: ${message.type}`);
    }
  }
}

// Import UserState type for use in the function above
import type { UserState } from "./store.js";

// ── Start ──────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[relay] Page Designer relay server listening on port ${PORT}`);
  console.log(`[relay]   WebSocket: ws://localhost:${PORT}/ws?id={userId}`);
  console.log(`[relay]   MCP:       http://localhost:${PORT}/mcp/{userId}`);
  console.log(`[relay]   Health:    http://localhost:${PORT}/health`);
});
