/**
 * Gradient parsing + serialization shared across panel contexts.
 *
 * Computed `background-image` / `border-image-source` values come back from the
 * browser in a normalized form (e.g. `linear-gradient(90deg, rgb(255, 255, 255)
 * 0%, rgb(0, 0, 0) 100%)`). These helpers turn that string into a structured
 * model the gradient editor can manipulate, and back again into valid CSS.
 *
 * Only `linear` and `radial` gradients are editable. Conic / repeating
 * gradients still parse (so we don't clobber them), but the editor treats them
 * as the closest editable type.
 */

export type GradientType = "linear" | "radial";

export interface GradientStop {
  /** Any CSS color string (hex, rgb(a), hsl(a), named). */
  color: string;
  /** Stop position, 0–100. */
  position: number;
}

export interface Gradient {
  type: GradientType;
  /** Angle in degrees — only meaningful for linear gradients. */
  angle: number;
  /** Radial shape keyword (e.g. "circle", "ellipse"). */
  shape: string;
  stops: GradientStop[];
}

/** True when a CSS value contains an editable gradient function. */
export function isGradient(value: string): boolean {
  return /(^|[\s,])(repeating-)?(linear|radial|conic)-gradient\(/i.test(value || "");
}

/** Split a comma-separated list, ignoring commas nested inside parentheses. */
function splitTopLevel(str: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of str) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const ANGLE_KEYWORDS: Record<string, number> = {
  "to top": 0,
  "to right": 90,
  "to bottom": 180,
  "to left": 270,
  "to top right": 45,
  "to right top": 45,
  "to bottom right": 135,
  "to right bottom": 135,
  "to bottom left": 225,
  "to left bottom": 225,
  "to top left": 315,
  "to left top": 315,
};

function parseAngle(dir: string): number {
  const d = dir.trim().toLowerCase();
  const m = d.match(/^(-?[\d.]+)(deg|grad|rad|turn)$/);
  if (m) {
    const val = parseFloat(m[1]);
    switch (m[2]) {
      case "grad":
        return val * 0.9;
      case "rad":
        return (val * 180) / Math.PI;
      case "turn":
        return val * 360;
      default:
        return val;
    }
  }
  return ANGLE_KEYWORDS[d] ?? 180;
}

/** Whether the first list item describes direction/shape rather than a color stop. */
function isDirectionPart(part: string, type: GradientType): boolean {
  const p = part.trim().toLowerCase();
  if (type === "linear") {
    return /^to\s/.test(p) || /^-?[\d.]+(deg|grad|rad|turn)$/.test(p);
  }
  return /^(circle|ellipse|closest-side|closest-corner|farthest-side|farthest-corner)\b/.test(p) || /\bat\b/.test(p);
}

/** Separate a stop into its color and (optional) explicit position. */
function splitColorAndPos(part: string): { color: string; position: number | null } {
  const trimmed = part.trim();
  // Trailing percentage(s): "rgb(0,0,0) 50%" or modern "red 10% 20%".
  const m = trimmed.match(/^(.*?)\s+(-?[\d.]+)%(?:\s+-?[\d.]+%)?$/);
  if (m) {
    return { color: m[1].trim(), position: parseFloat(m[2]) };
  }
  return { color: trimmed, position: null };
}

function parseStops(parts: string[]): GradientStop[] {
  const raw: Array<{ color: string; position: number | null }> = [];
  for (const part of parts) {
    const { color, position } = splitColorAndPos(part);
    // Skip bare interpolation hints (a lone percentage with no color).
    if (!color || /^-?[\d.]+%$/.test(color)) continue;
    raw.push({ color, position });
  }

  const n = raw.length;
  return raw.map((s, i) => ({
    color: s.color,
    position:
      s.position !== null
        ? s.position
        : i === 0
        ? 0
        : i === n - 1
        ? 100
        : Math.round((i / (n - 1)) * 100),
  }));
}

/** Parse a CSS gradient string into an editable model, or null if unsupported. */
export function parseGradient(input: string): Gradient | null {
  if (!input) return null;
  const m = input.trim().match(/^(repeating-)?(linear|radial|conic)-gradient\s*\(([\s\S]*)\)\s*$/i);
  if (!m) return null;

  const type: GradientType = m[2].toLowerCase() === "radial" ? "radial" : "linear";
  const parts = splitTopLevel(m[3]);

  let angle = 180;
  let shape = "circle";
  let stopParts = parts;

  if (parts.length > 0 && isDirectionPart(parts[0], type)) {
    if (type === "linear") angle = parseAngle(parts[0]);
    else shape = parts[0].trim();
    stopParts = parts.slice(1);
  }

  const stops = parseStops(stopParts);
  if (stops.length === 0) return null;
  return { type, angle, shape, stops };
}

const round = (n: number) => Math.round(n * 100) / 100;

function stopsToCss(stops: GradientStop[]): string {
  return [...stops]
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${round(s.position)}%`)
    .join(", ");
}

/** Serialize an editable model back into a CSS gradient string. */
export function buildGradient(g: Gradient): string {
  const stops = stopsToCss(g.stops);
  if (g.type === "radial") {
    return `radial-gradient(${g.shape || "circle"}, ${stops})`;
  }
  return `linear-gradient(${round(g.angle)}deg, ${stops})`;
}

/**
 * Horizontal preview of a gradient's stops, independent of its angle/shape, so
 * the editor's track always reads left-to-right.
 */
export function buildPreview(stops: GradientStop[]): string {
  return `linear-gradient(to right, ${stopsToCss(stops)})`;
}

/** A sensible two-stop default seeded from a base color. */
export function defaultGradient(baseColor: string = "#4f9eff"): Gradient {
  return {
    type: "linear",
    angle: 180,
    shape: "circle",
    stops: [
      { color: baseColor, position: 0 },
      { color: "rgba(0, 0, 0, 0)", position: 100 },
    ],
  };
}
