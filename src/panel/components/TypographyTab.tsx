import React, { useCallback, useMemo } from "react";
import { NumberInput, SelectDropdown, ColorPicker } from "../controls";
import "./typography.css";

interface Props {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

const FONT_FAMILY_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Georgia", label: "Georgia" },
  { value: "'Times New Roman'", label: "Times New Roman" },
  { value: "'Courier New'", label: "Courier New" },
  { value: "Verdana", label: "Verdana" },
  { value: "system-ui", label: "system-ui" },
  { value: "monospace", label: "monospace" },
];

const FONT_WEIGHT_OPTIONS = [
  { value: "100", label: "Thin" },
  { value: "200", label: "ExtraLight" },
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "SemiBold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "ExtraBold" },
  { value: "900", label: "Black" },
];

const ALIGNMENT_OPTIONS = [
  { value: "left", icon: "\u2261" },
  { value: "center", icon: "\u2261" },
  { value: "right", icon: "\u2261" },
  { value: "justify", icon: "\u2261" },
] as const;

const ALIGNMENT_LABELS: Record<string, string> = {
  left: "\u2590\u2500",
  center: "\u2500\u2502\u2500",
  right: "\u2500\u258C",
  justify: "\u2500\u2500",
};

const TRANSFORM_OPTIONS = [
  { value: "none", label: "Aa" },
  { value: "uppercase", label: "AA" },
  { value: "lowercase", label: "aa" },
] as const;

const DECORATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "underline", label: "U\u0332" },
  { value: "line-through", label: "S\u0336" },
] as const;

/** Parse a px value string like "16px" to a number */
function parsePx(val: string | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

/** Resolve the first font-family from a computed value */
function resolveFamily(val: string | undefined): string {
  if (!val) return "Inter";
  // Computed font-family may be a list; take the first entry
  const first = val.split(",")[0].trim().replace(/^["']|["']$/g, "");
  // Try to match one of our options
  for (const opt of FONT_FAMILY_OPTIONS) {
    const optClean = opt.value.replace(/'/g, "");
    if (first.toLowerCase() === optClean.toLowerCase()) return opt.value;
  }
  return FONT_FAMILY_OPTIONS[0].value;
}

/** Resolve font-weight from computed value */
function resolveWeight(val: string | undefined): string {
  if (!val) return "400";
  const n = parseInt(val, 10);
  if (!isNaN(n)) {
    // Clamp to nearest hundred
    const clamped = Math.round(n / 100) * 100;
    const s = String(Math.max(100, Math.min(900, clamped)));
    return FONT_WEIGHT_OPTIONS.some((o) => o.value === s) ? s : "400";
  }
  return "400";
}

export function TypographyTab({ computedStyles, onStyleChange }: Props) {
  const fontFamily = useMemo(
    () => resolveFamily(computedStyles["font-family"]),
    [computedStyles["font-family"]]
  );

  const fontWeight = useMemo(
    () => resolveWeight(computedStyles["font-weight"]),
    [computedStyles["font-weight"]]
  );

  const fontSize = useMemo(
    () => parsePx(computedStyles["font-size"]),
    [computedStyles["font-size"]]
  );

  const lineHeight = useMemo(() => {
    const raw = computedStyles["line-height"];
    if (!raw || raw === "normal") {
      // Approximate "normal" as 1.2x the font size
      return Math.round(fontSize * 1.2 * 100) / 100;
    }
    return parsePx(raw);
  }, [computedStyles["line-height"], fontSize]);

  const letterSpacing = useMemo(() => {
    const raw = computedStyles["letter-spacing"];
    if (!raw || raw === "normal") return 0;
    return parsePx(raw);
  }, [computedStyles["letter-spacing"]]);

  const textAlign = computedStyles["text-align"] || "left";
  const textTransform = computedStyles["text-transform"] || "none";
  const textColor = computedStyles["color"] || "#000000";
  const textDecoration = useMemo(() => {
    const raw = computedStyles["text-decoration"] || computedStyles["text-decoration-line"] || "none";
    if (raw.includes("underline")) return "underline";
    if (raw.includes("line-through")) return "line-through";
    return "none";
  }, [computedStyles["text-decoration"], computedStyles["text-decoration-line"]]);

  const handleFontFamily = useCallback(
    (v: string) => onStyleChange("font-family", v),
    [onStyleChange]
  );

  const handleFontWeight = useCallback(
    (v: string) => onStyleChange("font-weight", v),
    [onStyleChange]
  );

  const handleFontSize = useCallback(
    (v: number) => onStyleChange("font-size", `${v}px`),
    [onStyleChange]
  );

  const handleLineHeight = useCallback(
    (v: number) => onStyleChange("line-height", `${v}px`),
    [onStyleChange]
  );

  const handleLetterSpacing = useCallback(
    (v: number) => onStyleChange("letter-spacing", `${v}px`),
    [onStyleChange]
  );

  const handleTextAlign = useCallback(
    (v: string) => onStyleChange("text-align", v),
    [onStyleChange]
  );

  const handleTextTransform = useCallback(
    (v: string) => onStyleChange("text-transform", v),
    [onStyleChange]
  );

  const handleTextColor = useCallback(
    (v: string) => onStyleChange("color", v),
    [onStyleChange]
  );

  const handleTextDecoration = useCallback(
    (v: string) => onStyleChange("text-decoration", v),
    [onStyleChange]
  );

  return (
    <div className="pd-typography">
      {/* Font */}
      <div className="pd-typography__row">
        <div className="pd-typography__row-label">Font</div>
        <div className="pd-typography__row-fields">
          <SelectDropdown
            label="Family"
            value={fontFamily}
            options={FONT_FAMILY_OPTIONS}
            onChange={handleFontFamily}
          />
          <SelectDropdown
            label="Weight"
            value={fontWeight}
            options={FONT_WEIGHT_OPTIONS}
            onChange={handleFontWeight}
          />
        </div>
      </div>

      {/* Size & Spacing */}
      <div className="pd-typography__row">
        <div className="pd-typography__row-label">Size & Spacing</div>
        <div className="pd-typography__row-fields">
          <NumberInput
            label="Size"
            value={fontSize}
            onChange={handleFontSize}
            min={1}
            max={999}
            step={1}
            suffix="px"
          />
          <NumberInput
            label="Line H"
            value={lineHeight}
            onChange={handleLineHeight}
            min={0}
            step={0.1}
            suffix="px"
          />
          <NumberInput
            label="Spacing"
            value={letterSpacing}
            onChange={handleLetterSpacing}
            step={0.1}
            suffix="px"
          />
        </div>
      </div>

      {/* Alignment */}
      <div className="pd-typography__row">
        <div className="pd-typography__row-label">Alignment</div>
        <div className="pd-typography__btn-group">
          {ALIGNMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`pd-typography__btn${
                textAlign === opt.value ? " pd-typography__btn--active" : ""
              }`}
              title={opt.value}
              onClick={() => handleTextAlign(opt.value)}
            >
              {ALIGNMENT_LABELS[opt.value]}
            </button>
          ))}
        </div>
      </div>

      {/* Transform */}
      <div className="pd-typography__row">
        <div className="pd-typography__row-label">Transform</div>
        <div className="pd-typography__btn-group">
          {TRANSFORM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`pd-typography__btn${
                textTransform === opt.value ? " pd-typography__btn--active" : ""
              }`}
              title={opt.value}
              onClick={() => handleTextTransform(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Text Color */}
      <div className="pd-typography__row">
        <div className="pd-typography__row-label">Text Color</div>
        <div className="pd-typography__color-row">
          <ColorPicker value={textColor} onChange={handleTextColor} />
        </div>
      </div>

      {/* Text Decoration */}
      <div className="pd-typography__row">
        <div className="pd-typography__row-label">Decoration</div>
        <div className="pd-typography__btn-group">
          {DECORATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`pd-typography__btn${
                textDecoration === opt.value ? " pd-typography__btn--active" : ""
              }`}
              title={opt.value}
              onClick={() => handleTextDecoration(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
