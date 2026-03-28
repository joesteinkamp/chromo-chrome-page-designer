import React from "react";

/** Extract the CSS variable name from a var() expression */
export function extractVarName(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.match(/var\(\s*(--[^,)]+)/);
  return match ? match[1].trim() : null;
}

/** Show a CSS variable badge when a property uses var() */
export function VarLabel({ authoredStyles, property }: { authoredStyles?: Record<string, string>; property: string | string[] }) {
  const props = Array.isArray(property) ? property : [property];
  for (const p of props) {
    const varName = extractVarName(authoredStyles?.[p]);
    if (varName) {
      return <div className="pd-var-label" title={authoredStyles?.[p]}>{varName}</div>;
    }
  }
  return null;
}
