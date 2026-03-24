/**
 * Export functions for change tracking data.
 * Produces JSON changesets (for Claude Code / Codex) and human-readable summaries.
 */

import type { Change, Changeset } from "./types";
import { CSS_TO_FIGMA } from "./css-mapping";

/** Create a structured JSON changeset suitable for AI coding tools */
export function exportAsJSON(url: string, changes: Change[]): string {
  const changeset: Changeset = {
    url,
    timestamp: new Date().toISOString(),
    description: summarizeChanges(changes),
    changes,
  };
  return JSON.stringify(changeset, null, 2);
}

/** Create a human-readable markdown summary */
export function exportAsSummary(url: string, changes: Change[]): string {
  if (changes.length === 0) {
    return `No changes recorded for ${url}`;
  }

  const lines: string[] = [
    `## Page Designer Changes`,
    `**URL:** ${url}`,
    `**Date:** ${new Date().toLocaleString()}`,
    `**Changes:** ${changes.length}`,
    ``,
  ];

  changes.forEach((change, i) => {
    const num = i + 1;
    switch (change.type) {
      case "style": {
        const label = CSS_TO_FIGMA[change.property] || change.property;
        lines.push(
          `${num}. Changed **${label}** on \`${change.selector}\` from \`${change.from}\` → \`${change.to}\``
        );
        break;
      }
      case "text":
        lines.push(
          `${num}. Changed **text** on \`${change.selector}\`: "${truncate(change.from, 40)}" → "${truncate(change.to, 40)}"`
        );
        break;
      case "move":
        lines.push(
          `${num}. **Moved** \`${change.selector}\` from position ${change.fromIndex} in \`${change.fromParent}\` → position ${change.toIndex} in \`${change.toParent}\``
        );
        break;
      case "resize":
        lines.push(
          `${num}. **Resized** \`${change.selector}\` from ${change.from.width} × ${change.from.height} → ${change.to.width} × ${change.to.height}`
        );
        break;
      case "image":
        lines.push(
          `${num}. **Replaced image** on \`${change.selector}\``
        );
        break;
    }
  });

  return lines.join("\n");
}

/** Generate a one-line summary of changes for the changeset description */
function summarizeChanges(changes: Change[]): string {
  const counts: Record<string, number> = {};
  for (const c of changes) {
    counts[c.type] = (counts[c.type] || 0) + 1;
  }

  const parts: string[] = [];
  if (counts.style) parts.push(`${counts.style} style change${counts.style > 1 ? "s" : ""}`);
  if (counts.text) parts.push(`${counts.text} text edit${counts.text > 1 ? "s" : ""}`);
  if (counts.move) parts.push(`${counts.move} move${counts.move > 1 ? "s" : ""}`);
  if (counts.resize) parts.push(`${counts.resize} resize${counts.resize > 1 ? "s" : ""}`);
  if (counts.image) parts.push(`${counts.image} image replacement${counts.image > 1 ? "s" : ""}`);

  return parts.join(", ") || "No changes";
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}
