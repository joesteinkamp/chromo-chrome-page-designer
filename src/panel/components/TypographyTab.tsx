import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { NumberInput, SelectDropdown, ColorPicker, FontPicker } from "../controls";
import { ALL_FONTS } from "../../shared/google-fonts";
import "./typography.css";

interface Props {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

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
  { value: "left", label: "\u2590\u2500" },
  { value: "center", label: "\u2500\u2502\u2500" },
  { value: "right", label: "\u2500\u258C" },
  { value: "justify", label: "\u2500\u2500" },
] as const;

const TRANSFORM_OPTIONS = [
  { value: "none", label: "\u2014" },
  { value: "uppercase", label: "AA" },
  { value: "lowercase", label: "aa" },
  { value: "capitalize", label: "Aa" },
] as const;

const DECORATION_OPTIONS = [
  { value: "none", label: "\u2014" },
  { value: "underline", label: "U\u0332" },
  { value: "line-through", label: "S\u0336" },
] as const;

function parsePx(val: string | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function resolveFamily(val: string | undefined): string {
  if (!val) return "Inter";
  const first = val.split(",")[0].trim().replace(/^["']|["']$/g, "");
  for (const f of ALL_FONTS) {
    if (first.toLowerCase() === f.value.toLowerCase()) return f.value;
  }
  return first || "Inter";
}

function resolveWeight(val: string | undefined): string {
  if (!val) return "400";
  const n = parseInt(val, 10);
  if (!isNaN(n)) {
    const clamped = Math.round(n / 100) * 100;
    const s = String(Math.max(100, Math.min(900, clamped)));
    return FONT_WEIGHT_OPTIONS.some((o) => o.value === s) ? s : "400";
  }
  return "400";
}

export function TypographyTab({ computedStyles, onStyleChange }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const detailsBtnRef = useRef<HTMLButtonElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        detailsBtnRef.current &&
        !detailsBtnRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popoverOpen]);

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
    if (!raw || raw === "normal") return Math.round(fontSize * 1.2 * 100) / 100;
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

  const handleFontFamily = useCallback((v: string) => onStyleChange("font-family", v), [onStyleChange]);
  const handleFontWeight = useCallback((v: string) => onStyleChange("font-weight", v), [onStyleChange]);
  const handleFontSize = useCallback((v: number) => onStyleChange("font-size", `${v}px`), [onStyleChange]);
  const handleLineHeight = useCallback((v: number) => onStyleChange("line-height", `${v}px`), [onStyleChange]);
  const handleLetterSpacing = useCallback((v: number) => onStyleChange("letter-spacing", `${v}px`), [onStyleChange]);
  const handleTextAlign = useCallback((v: string) => onStyleChange("text-align", v), [onStyleChange]);
  const handleTextTransform = useCallback((v: string) => onStyleChange("text-transform", v), [onStyleChange]);
  const handleTextColor = useCallback((v: string) => onStyleChange("color", v), [onStyleChange]);
  const handleTextDecoration = useCallback((v: string) => onStyleChange("text-decoration", v), [onStyleChange]);

  return (
    <div className="pd-section">
      {/* Section header */}
      <div className="pd-section__header" onClick={() => setCollapsed((c) => !c)}>
        <span className="pd-section__title">Typography</span>
        <div className="pd-typography__header-actions" onClick={(e) => e.stopPropagation()}>
          <button
            ref={detailsBtnRef}
            className={`pd-section__icon-btn${popoverOpen ? " pd-section__icon-btn--active" : ""}`}
            type="button"
            title="Type details"
            onClick={() => setPopoverOpen((o) => !o)}
          >
            &#x2699;
          </button>
          <span
            className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}
            onClick={() => setCollapsed((c) => !c)}
          >
            &#9662;
          </span>
        </div>
      </div>

      {/* Main compact section */}
      {!collapsed && (
        <div className="pd-section__content">
          {/* Font family — full width */}
          <div className="pd-section__row">
            <FontPicker
              value={fontFamily}
              onChange={handleFontFamily}
            />
          </div>

          {/* Weight + Size */}
          <div className="pd-section__row pd-section__row--half">
            <SelectDropdown
              value={fontWeight}
              options={FONT_WEIGHT_OPTIONS}
              onChange={handleFontWeight}
            />
            <NumberInput
              value={fontSize}
              onChange={handleFontSize}
              min={1}
              max={999}
              suffix="px"
            />
          </div>

          {/* Line height + Letter spacing */}
          <div className="pd-section__row pd-section__row--half">
            <NumberInput
              label="&#x2195;"
              value={lineHeight}
              onChange={handleLineHeight}
              min={0}
              step={0.1}
              suffix="px"
            />
            <NumberInput
              label="|A|"
              value={letterSpacing}
              onChange={handleLetterSpacing}
              step={0.1}
              suffix="px"
            />
          </div>

          {/* Alignment buttons */}
          <div className="pd-section__row">
            <div className="pd-typography__btn-group">
              {ALIGNMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`pd-typography__btn${textAlign === opt.value ? " pd-typography__btn--active" : ""}`}
                  title={opt.value}
                  onClick={() => handleTextAlign(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Details popover */}
      {popoverOpen && (
        <div className="pd-typography__popover" ref={popoverRef}>
          <div className="pd-typography__popover-header">
            <span className="pd-typography__popover-title">Type details</span>
            <button
              className="pd-typography__popover-close"
              type="button"
              onClick={() => setPopoverOpen(false)}
            >
              &times;
            </button>
          </div>

          {/* Alignment */}
          <div className="pd-typography__popover-row">
            <span className="pd-typography__popover-label">Alignment</span>
            <div className="pd-typography__btn-group pd-typography__btn-group--sm">
              {ALIGNMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`pd-typography__btn pd-typography__btn--sm${textAlign === opt.value ? " pd-typography__btn--active" : ""}`}
                  title={opt.value}
                  onClick={() => handleTextAlign(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Decoration */}
          <div className="pd-typography__popover-row">
            <span className="pd-typography__popover-label">Decoration</span>
            <div className="pd-typography__btn-group pd-typography__btn-group--sm">
              {DECORATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`pd-typography__btn pd-typography__btn--sm${textDecoration === opt.value ? " pd-typography__btn--active" : ""}`}
                  title={opt.value}
                  onClick={() => handleTextDecoration(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Case / Transform */}
          <div className="pd-typography__popover-row">
            <span className="pd-typography__popover-label">Case</span>
            <div className="pd-typography__btn-group pd-typography__btn-group--sm">
              {TRANSFORM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`pd-typography__btn pd-typography__btn--sm${textTransform === opt.value ? " pd-typography__btn--active" : ""}`}
                  title={opt.value}
                  onClick={() => handleTextTransform(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Color */}
          <div className="pd-typography__popover-row">
            <span className="pd-typography__popover-label">Color</span>
            <div className="pd-typography__popover-color">
              <ColorPicker value={textColor} onChange={handleTextColor} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
