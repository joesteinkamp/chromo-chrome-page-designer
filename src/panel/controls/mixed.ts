/**
 * Helpers for Figma-style "Mixed" values in a multi-selection.
 *
 * The content script merges the selection's styles and writes MIXED_VALUE
 * where elements disagree. Numeric sections must parse through
 * parseNumericValue so the sentinel surfaces as NaN — NumberInput renders
 * NaN as a "Mixed" placeholder — instead of being coerced to 0 by
 * `parseFloat(v) || 0`.
 */

import { MIXED_VALUE } from "../../shared/constants";

export function isMixedValue(value: string | undefined | null): boolean {
  return value === MIXED_VALUE;
}

/** parseFloat with a fallback, except MIXED_VALUE becomes NaN (→ "Mixed"). */
export function parseNumericValue(
  value: string | undefined,
  fallback = 0
): number {
  if (value === MIXED_VALUE) return NaN;
  const parsed = parseFloat(value ?? "");
  return isNaN(parsed) ? fallback : parsed;
}
