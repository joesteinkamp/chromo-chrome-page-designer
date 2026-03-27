/**
 * Export functions for change tracking data.
 * Produces JSON changesets (for Claude Code / Codex) and human-readable summaries.
 * Supports grouping changes by element and optional session notes.
 */

import type { Change, Changeset, ElementData } from "./types";
import { CSS_TO_FIGMA } from "./css-mapping";

/** Component context associated with a CSS selector */
export interface ComponentContext {
  framework: string | null;
  componentName: string | null;
  componentHierarchy: string[];
  sourceFile: string | null;
  sourceLine: number | null;
}

/** Group changes by selector for cleaner export */
interface GroupedChanges {
  selector: string;
  component?: ComponentContext;
  changes: Change[];
}

function groupBySelector(changes: Change[], componentMap?: Map<string, ComponentContext>): GroupedChanges[] {
  const map = new Map<string, Change[]>();
  for (const c of changes) {
    const existing = map.get(c.selector) || [];
    existing.push(c);
    map.set(c.selector, existing);
  }
  return Array.from(map.entries()).map(([selector, changes]) => ({
    selector,
    ...(componentMap?.get(selector) ? { component: componentMap.get(selector) } : {}),
    changes,
  }));
}

/** Create a structured JSON changeset suitable for AI coding tools */
export function exportAsJSON(
  url: string,
  changes: Change[],
  sessionNote?: string,
  componentMap?: Map<string, ComponentContext>
): string {
  const changeset: Changeset & { sessionNote?: string; groups?: GroupedChanges[] } = {
    url,
    timestamp: new Date().toISOString(),
    description: summarizeChanges(changes),
    changes,
  };
  if (sessionNote) {
    changeset.sessionNote = sessionNote;
  }
  // Add grouped view with component context for developer convenience
  changeset.groups = groupBySelector(changes, componentMap);
  return JSON.stringify(changeset, null, 2);
}

/** Create a human-readable markdown summary with grouped changes */
export function exportAsSummary(
  url: string,
  changes: Change[],
  sessionNote?: string,
  componentMap?: Map<string, ComponentContext>
): string {
  if (changes.length === 0) {
    return `No changes recorded for ${url}`;
  }

  const lines: string[] = [
    `**URL:** ${url}`,
    `**Changes:** ${changes.length}`,
  ];

  if (sessionNote) {
    lines.push(`**Note:** ${sessionNote}`);
  }
  lines.push(``);

  // Group by selector
  const groups = groupBySelector(changes, componentMap);

  for (const group of groups) {
    let header = `### \`${group.selector}\``;
    if (group.component?.componentName) {
      header += ` — \`<${group.component.componentName}>\``;
      if (group.component.sourceFile) {
        header += ` (${group.component.sourceFile}${group.component.sourceLine ? `:${group.component.sourceLine}` : ""})`;
      }
    }
    header += ` (${group.changes.length} change${group.changes.length > 1 ? "s" : ""})`;
    lines.push(header);

    for (const change of group.changes) {
      switch (change.type) {
        case "style": {
          const label = CSS_TO_FIGMA[change.property] || change.property;
          lines.push(
            `- Changed **${label}**: \`${change.from}\` → \`${change.to}\``
          );
          break;
        }
        case "text":
          lines.push(
            `- Changed **text**: "${change.from}" → "${change.to}"`
          );
          break;
        case "move":
          lines.push(
            `- **Moved** from position ${change.fromIndex} → ${change.toIndex}`
          );
          break;
        case "resize":
          lines.push(
            `- **Resized**: ${change.from.width} × ${change.from.height} → ${change.to.width} × ${change.to.height}`
          );
          break;
        case "image":
          lines.push(`- **Replaced image**`);
          break;
        case "delete":
          lines.push(`- **Deleted** element`);
          break;
        case "hide":
          lines.push(`- **Hidden** element`);
          break;
        case "wrap":
          lines.push(`- **Wrapped** in group container`);
          break;
        case "duplicate":
          lines.push(`- **Duplicated** element`);
          break;
      }
    }

    lines.push(``);
  }

  return lines.join("\n");
}

/** Generate a one-line summary of changes for the changeset description */
function summarizeChanges(changes: Change[]): string {
  const counts: Record<string, number> = {};
  for (const c of changes) {
    counts[c.type] = (counts[c.type] || 0) + 1;
  }

  const parts: string[] = [];
  if (counts.style)
    parts.push(`${counts.style} style change${counts.style > 1 ? "s" : ""}`);
  if (counts.text)
    parts.push(`${counts.text} text edit${counts.text > 1 ? "s" : ""}`);
  if (counts.move)
    parts.push(`${counts.move} move${counts.move > 1 ? "s" : ""}`);
  if (counts.resize)
    parts.push(`${counts.resize} resize${counts.resize > 1 ? "s" : ""}`);
  if (counts.image)
    parts.push(
      `${counts.image} image replacement${counts.image > 1 ? "s" : ""}`
    );
  if (counts.delete)
    parts.push(`${counts.delete} deletion${counts.delete > 1 ? "s" : ""}`);
  if (counts.hide)
    parts.push(
      `${counts.hide} hidden element${counts.hide > 1 ? "s" : ""}`
    );
  if (counts.wrap)
    parts.push(`${counts.wrap} group wrap${counts.wrap > 1 ? "s" : ""}`);
  if (counts.duplicate)
    parts.push(`${counts.duplicate} duplication${counts.duplicate > 1 ? "s" : ""}`);

  return parts.join(", ") || "No changes";
}

/**
 * Generate a visual diff screenshot description.
 * Returns an HTML string that can be used in the side panel to show
 * which elements were changed with highlighted outlines.
 */
export function generateVisualDiffAnnotations(
  changes: Change[]
): Array<{ selector: string; count: number; description: string }> {
  const groups = groupBySelector(changes);
  return groups.map((g) => ({
    selector: g.selector,
    count: g.changes.length,
    description: g.changes.map((c) => c.description).join("; "),
  }));
}

