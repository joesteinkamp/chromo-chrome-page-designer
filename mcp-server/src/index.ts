#!/usr/bin/env node

/**
 * Page Designer MCP Server
 *
 * Two interfaces:
 * 1. stdio — MCP protocol for Claude Code (tools + resources)
 * 2. HTTP on localhost:19532 — receives changesets from the Chrome extension
 *
 * Claude Code config:
 *   "page-designer": {
 *     "command": "node",
 *     "args": ["/path/to/mcp-server/dist/index.js"]
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "http";

// --- In-memory changeset store ---

interface Changeset {
  url: string;
  timestamp: string;
  description: string;
  changes: any[];
  receivedAt: string;
}

let latestChangeset: Changeset | null = null;
let changeHistory: Changeset[] = [];
const MAX_HISTORY = 20;

function storeChangeset(data: any): void {
  const changeset: Changeset = {
    url: data.url || "unknown",
    timestamp: data.timestamp || new Date().toISOString(),
    description: data.description || `${data.changes?.length || 0} changes`,
    changes: data.changes || [],
    receivedAt: new Date().toISOString(),
  };
  latestChangeset = changeset;
  changeHistory.unshift(changeset);
  if (changeHistory.length > MAX_HISTORY) {
    changeHistory = changeHistory.slice(0, MAX_HISTORY);
  }
}

// --- HTTP server for Chrome extension ---

const HTTP_PORT = 19532;

const httpServer = createServer((req, res) => {
  // CORS headers for Chrome extension
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/changes") {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        storeChangeset(data);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, stored: latestChangeset?.receivedAt }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Invalid JSON" }));
      }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/changes") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(latestChangeset || { changes: [] }));
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, pending: latestChangeset !== null }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(HTTP_PORT, "127.0.0.1", () => {
  // Log to stderr so it doesn't interfere with stdio MCP transport
  process.stderr.write(`Page Designer MCP: HTTP listening on http://127.0.0.1:${HTTP_PORT}\n`);
});

// --- MCP Server (stdio) ---

const server = new McpServer({
  name: "page-designer",
  version: "0.1.0",
});

// Tool: get the latest design changes from the Chrome extension
server.tool(
  "get_design_changes",
  "Get the latest visual design changes made in the Page Designer Chrome extension. Returns a structured changeset with CSS selectors, property changes, and before/after values that can be applied to source code.",
  {},
  async () => {
    if (!latestChangeset || latestChangeset.changes.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No design changes pending. Open the Page Designer Chrome extension, make visual edits, then click 'Send Changes > Send to Claude Code'.",
          },
        ],
      };
    }

    const summary = formatChangeSummary(latestChangeset);

    return {
      content: [
        {
          type: "text" as const,
          text: summary,
        },
      ],
    };
  }
);

// Tool: apply and clear — mark changes as consumed
server.tool(
  "acknowledge_design_changes",
  "Acknowledge that design changes have been applied to the codebase. Clears the pending changeset.",
  {},
  async () => {
    const count = latestChangeset?.changes.length || 0;
    latestChangeset = null;
    return {
      content: [
        {
          type: "text" as const,
          text: `Acknowledged. Cleared ${count} pending design changes.`,
        },
      ],
    };
  }
);

// Tool: get change history
server.tool(
  "get_design_change_history",
  "Get the history of design changesets sent from the Page Designer Chrome extension.",
  {},
  async () => {
    if (changeHistory.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No change history available.",
          },
        ],
      };
    }

    const lines = changeHistory.map(
      (cs, i) =>
        `${i + 1}. [${cs.receivedAt}] ${cs.url} — ${cs.changes.length} changes: ${cs.description}`
    );

    return {
      content: [
        {
          type: "text" as const,
          text: `Design change history (${changeHistory.length} entries):\n\n${lines.join("\n")}`,
        },
      ],
    };
  }
);

// Resource: latest changeset as JSON
server.resource(
  "changes",
  "page-designer://changes",
  async (uri) => {
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(latestChangeset || { changes: [] }, null, 2),
        },
      ],
    };
  }
);

// --- Helpers ---

function formatChangeSummary(cs: Changeset): string {
  const lines: string[] = [
    `# Page Designer Changes`,
    ``,
    `**URL:** ${cs.url}`,
    `**Time:** ${cs.timestamp}`,
    `**Changes:** ${cs.changes.length}`,
    ``,
    `## Instructions`,
    ``,
    `Apply the following visual changes to the source code. Each change includes a CSS selector identifying the element and the property/value to change. Find the corresponding component or stylesheet in the codebase and update it.`,
    ``,
    `## Changes`,
    ``,
  ];

  for (const change of cs.changes) {
    switch (change.type) {
      case "style":
        lines.push(
          `- **${change.property}** on \`${change.selector}\`: \`${change.from}\` → \`${change.to}\``
        );
        break;
      case "text":
        lines.push(
          `- **text content** on \`${change.selector}\`: "${change.from}" → "${change.to}"`
        );
        break;
      case "move":
        lines.push(
          `- **move** \`${change.selector}\` from position ${change.fromIndex} in \`${change.fromParent}\` → position ${change.toIndex} in \`${change.toParent}\``
        );
        break;
      case "resize":
        lines.push(
          `- **resize** \`${change.selector}\`: ${change.from.width}×${change.from.height} → ${change.to.width}×${change.to.height}`
        );
        break;
      case "image":
        lines.push(
          `- **replace image** on \`${change.selector}\`: new src = \`${change.to}\``
        );
        break;
    }
  }

  lines.push(``);
  lines.push(`## Raw JSON`);
  lines.push(``);
  lines.push("```json");
  lines.push(JSON.stringify(cs, null, 2));
  lines.push("```");

  return lines.join("\n");
}

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Page Designer MCP: Connected via stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Page Designer MCP error: ${err}\n`);
  process.exit(1);
});
