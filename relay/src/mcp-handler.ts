import type { ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  getUser,
  touchUser,
  broadcastToSSE,
  type UserState,
  type Change,
} from "./store.js";

// ── Types ──────────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface McpToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ── Session management ─────────────────────────────────────────────────────

const sessions = new Map<string, { userId: string; createdAt: number }>();

export function getOrCreateSession(
  userId: string,
  existingSessionId?: string
): string {
  if (existingSessionId && sessions.has(existingSessionId)) {
    return existingSessionId;
  }
  const sessionId = randomUUID();
  sessions.set(sessionId, { userId, createdAt: Date.now() });
  return sessionId;
}

export function getSessionUserId(sessionId: string): string | undefined {
  return sessions.get(sessionId)?.userId;
}

// ── Tool definitions ───────────────────────────────────────────────────────

const TOOLS: McpToolDef[] = [
  {
    name: "get_page_info",
    description: "Returns the current page URL and title being designed.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_selected_element",
    description:
      "Returns the currently selected element's selector, tag, classes, component info (framework, name, source file/line), computed styles, breadcrumb, and design tokens.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_changes",
    description:
      "Returns all tracked changes with full detail including type, selector, from/to values, and component context.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_change_summary",
    description:
      "Returns a human-readable markdown summary of all tracked changes.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "apply_style",
    description:
      "Send a CSS style change to the extension. The change will be applied live in the browser.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the target element.",
        },
        property: {
          type: "string",
          description: "CSS property name (e.g. 'background-color').",
        },
        value: {
          type: "string",
          description: "CSS value to set (e.g. '#ff0000').",
        },
      },
      required: ["selector", "property", "value"],
    },
  },
  {
    name: "apply_text",
    description:
      "Send a text content change to the extension. The text will be updated live in the browser.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the target element.",
        },
        text: {
          type: "string",
          description: "New text content for the element.",
        },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "resolve_change",
    description:
      "Mark a tracked change as resolved/implemented by its change ID.",
    inputSchema: {
      type: "object",
      properties: {
        changeId: {
          type: "string",
          description: "The ID of the change to mark as resolved.",
        },
      },
      required: ["changeId"],
    },
  },
  {
    name: "get_element_styles",
    description:
      "Request computed styles for a specific element by selector. Sends a request to the extension and returns the result.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the element to inspect.",
        },
      },
      required: ["selector"],
    },
  },
];

// ── Tool execution ─────────────────────────────────────────────────────────

function textContent(text: string): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text }] };
}

function sendToExtension(state: UserState, message: Record<string, unknown>): boolean {
  if (!state.wsConnection || state.wsConnection.readyState !== 1 /* OPEN */) {
    return false;
  }
  try {
    state.wsConnection.send(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}

function executeTool(
  userId: string,
  name: string,
  args: Record<string, unknown>
): JsonRpcResponse["result"] {
  const state = getUser(userId);
  if (!state) {
    return textContent(`Error: No active session for user ${userId}. The extension is not connected.`);
  }
  touchUser(userId);

  switch (name) {
    case "get_page_info": {
      return textContent(
        JSON.stringify(
          { pageUrl: state.pageUrl, pageTitle: state.pageTitle },
          null,
          2
        )
      );
    }

    case "get_selected_element": {
      if (!state.selectedElement) {
        return textContent("No element is currently selected in the designer.");
      }
      return textContent(JSON.stringify(state.selectedElement, null, 2));
    }

    case "get_changes": {
      if (state.changes.length === 0) {
        return textContent("No changes have been tracked yet.");
      }
      return textContent(JSON.stringify(state.changes, null, 2));
    }

    case "get_change_summary": {
      if (state.changes.length === 0) {
        return textContent("No changes have been tracked yet.");
      }
      return textContent(formatChangeSummary(state.changes, state.pageUrl, state.pageTitle));
    }

    case "apply_style": {
      const { selector, property, value } = args as {
        selector: string;
        property: string;
        value: string;
      };
      const sent = sendToExtension(state, {
        type: "apply_style",
        selector,
        property,
        value,
      });
      if (!sent) {
        return textContent(
          "Error: Extension is not connected. Cannot apply style change."
        );
      }
      return textContent(
        `Style change sent: ${property}: ${value} on ${selector}`
      );
    }

    case "apply_text": {
      const { selector, text } = args as { selector: string; text: string };
      const sent = sendToExtension(state, {
        type: "apply_text",
        selector,
        text,
      });
      if (!sent) {
        return textContent(
          "Error: Extension is not connected. Cannot apply text change."
        );
      }
      return textContent(`Text change sent: "${text}" on ${selector}`);
    }

    case "resolve_change": {
      const { changeId } = args as { changeId: string };
      const change = state.changes.find((c) => c.id === changeId);
      if (!change) {
        return textContent(`Error: Change with ID "${changeId}" not found.`);
      }
      change.resolved = true;
      broadcastToSSE(userId, "change_resolved", { changeId });
      return textContent(`Change "${changeId}" marked as resolved.`);
    }

    case "get_element_styles": {
      const { selector } = args as { selector: string };
      // Check if we have the element cached as the selected element
      if (
        state.selectedElement &&
        state.selectedElement.selector === selector
      ) {
        return textContent(
          JSON.stringify(state.selectedElement.computedStyles, null, 2)
        );
      }
      // Otherwise request from extension
      const sent = sendToExtension(state, {
        type: "get_element_styles",
        selector,
      });
      if (!sent) {
        return textContent(
          "Error: Extension is not connected. Cannot fetch element styles."
        );
      }
      // Check component map for cached data
      const cached = state.componentMap[selector];
      if (cached?.computedStyles) {
        return textContent(JSON.stringify(cached.computedStyles, null, 2));
      }
      return textContent(
        `Style request sent for ${selector}. The styles will be available on the next state update. ` +
        `Try calling get_selected_element or get_element_styles again shortly.`
      );
    }

    default:
      return textContent(`Error: Unknown tool "${name}".`);
  }
}

// ── Change summary formatter ───────────────────────────────────────────────

function formatChangeSummary(changes: Change[], pageUrl: string, pageTitle: string): string {
  const lines: string[] = [];
  lines.push(`# Page Designer Change Summary`);
  lines.push("");
  lines.push(`**Page:** ${pageTitle || "Untitled"}`);
  lines.push(`**URL:** ${pageUrl || "N/A"}`);
  lines.push(`**Total changes:** ${changes.length}`);
  lines.push(
    `**Resolved:** ${changes.filter((c) => c.resolved).length} / ${changes.length}`
  );
  lines.push("");

  const grouped: Record<string, Change[]> = {};
  for (const change of changes) {
    const key = change.selector;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(change);
  }

  for (const [selector, selectorChanges] of Object.entries(grouped)) {
    lines.push(`## \`${selector}\``);

    const comp = selectorChanges[0].component;
    if (comp) {
      lines.push(
        `> Component: **${comp.name}** (${comp.framework})` +
          (comp.sourceFile
            ? ` — \`${comp.sourceFile}${comp.sourceLine ? `:${comp.sourceLine}` : ""}\``
            : "")
      );
    }

    lines.push("");
    lines.push("| Property | From | To | Status |");
    lines.push("|----------|------|----|--------|");

    for (const c of selectorChanges) {
      const status = c.resolved ? "Resolved" : "Pending";
      lines.push(
        `| \`${c.property}\` | \`${c.fromValue || "(none)"}\` | \`${c.toValue}\` | ${status} |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── JSON-RPC dispatch ──────────────────────────────────────────────────────

export function handleMcpRequest(
  userId: string,
  request: JsonRpcRequest
): JsonRpcResponse {
  const { method, params, id } = request;

  switch (method) {
    case "initialize": {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "page-designer-relay",
            version: "0.1.0",
          },
        },
      };
    }

    case "notifications/initialized": {
      // Client acknowledgment — no response needed for notifications,
      // but since it has an id we respond.
      return { jsonrpc: "2.0", id, result: {} };
    }

    case "tools/list": {
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: TOOLS },
      };
    }

    case "tools/call": {
      const toolName = (params as any)?.name as string;
      const toolArgs = ((params as any)?.arguments ?? {}) as Record<string, unknown>;

      if (!toolName) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "Missing tool name in params." },
        };
      }

      const tool = TOOLS.find((t) => t.name === toolName);
      if (!tool) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: `Unknown tool: ${toolName}` },
        };
      }

      // Validate required params
      const required = tool.inputSchema.required ?? [];
      for (const req of required) {
        if (!(req in toolArgs)) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32602,
              message: `Missing required argument: ${req}`,
            },
          };
        }
      }

      const result = executeTool(userId, toolName, toolArgs);
      return { jsonrpc: "2.0", id, result };
    }

    default: {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
    }
  }
}
