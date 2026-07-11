import React, { useState, useCallback, useEffect, useRef } from "react";
import { ColorPicker, GradientEditor, NumberInput, SelectDropdown } from "../controls";
import { VarLabel } from "./VarLabel";
import { ChevronDown, PlusIcon, MinusIcon, GearIcon } from "../icons";
import { isGradient, parseGradient, buildGradient, defaultGradient } from "../../shared/gradient";
import { parseNumericValue } from "../controls/mixed";
import "./sections.css";

interface StrokeSectionProps {
  computedStyles: Record<string, string>;
  authoredStyles?: Record<string, string>;
  pageColors?: string[];
  pageStrokeWidths?: number[];
  designTokens?: Array<{ name: string; value: string }>;
  onStyleChange: (property: string, value: string) => void;
}

type StrokeMode = "single" | "sides";

const BORDER_STYLE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
];

const SIDE_PROPS = [
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
] as const;

const SIDE_STYLE_PROPS = [
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
];

function parsePx(val: string): number {
  // NaN → NumberInput renders the multi-selection "Mixed" placeholder
  return parseNumericValue(val, 0);
}

function detectMode(widths: string[]): StrokeMode {
  if (widths[0] === widths[1] && widths[1] === widths[2] && widths[2] === widths[3]) return "single";
  return "sides";
}

export const StrokeSection: React.FC<StrokeSectionProps> = ({
  computedStyles,
  authoredStyles,
  pageColors,
  pageStrokeWidths,
  designTokens,
  onStyleChange,
}) => {
  const sideColors = [
    computedStyles["border-top-color"] || "rgb(0, 0, 0)",
    computedStyles["border-right-color"] || "rgb(0, 0, 0)",
    computedStyles["border-bottom-color"] || "rgb(0, 0, 0)",
    computedStyles["border-left-color"] || "rgb(0, 0, 0)",
  ];
  const sideStyles = [
    computedStyles["border-top-style"] || "none",
    computedStyles["border-right-style"] || "none",
    computedStyles["border-bottom-style"] || "none",
    computedStyles["border-left-style"] || "none",
  ];
  const sideWidths: [string, string, string, string] = [
    computedStyles["border-top-width"] || "0px",
    computedStyles["border-right-width"] || "0px",
    computedStyles["border-bottom-width"] || "0px",
    computedStyles["border-left-width"] || "0px",
  ];

  const activeSide = sideStyles.findIndex((s, i) => s !== "none" && parsePx(sideWidths[i]) > 0);
  const borderColor = activeSide >= 0 ? sideColors[activeSide] : sideColors[0];
  const borderStyle = activeSide >= 0 ? sideStyles[activeSide] : sideStyles[0];

  // Gradient stroke via border-image (square corners — a border-image limitation).
  const borderImage = computedStyles["border-image-source"] || "none";
  const hasGradient = isGradient(borderImage);

  const hasValue =
    hasGradient || sideStyles.some((s, i) => s !== "none" && parsePx(sideWidths[i]) > 0);
  const [collapsed, setCollapsed] = useState(!hasValue);
  useEffect(() => { setCollapsed(!hasValue); }, [hasValue]);

  const [mode, setMode] = useState<StrokeMode>(() => detectMode(sideWidths));
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);

  // Auto-upgrade mode when sides differ
  useEffect(() => {
    const needed = detectMode(sideWidths);
    if (needed === "sides" && mode !== "sides") setMode("sides");
  }, [sideWidths]);

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        gearRef.current && !gearRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popoverOpen]);

  const selectMode = (m: StrokeMode) => {
    setMode(m);
  };

  const ensureBorderStyle = useCallback(
    (width: number) => {
      if (width > 0 && borderStyle === "none") {
        onStyleChange("border-style", "solid");
      }
    },
    [borderStyle, onStyleChange]
  );

  const handleColorChange = useCallback(
    (v: string) => { onStyleChange("border-color", v); },
    [onStyleChange]
  );

  const handleWidthChange = useCallback(
    (v: number) => {
      ensureBorderStyle(v);
      onStyleChange("border-width", `${v}px`);
    },
    [onStyleChange, ensureBorderStyle]
  );

  const handleSideWidthChange = useCallback(
    (index: number, v: number) => {
      if (v > 0 && sideStyles[index] === "none") {
        onStyleChange(SIDE_STYLE_PROPS[index], "solid");
      }
      onStyleChange(SIDE_PROPS[index], `${v}px`);
    },
    [onStyleChange, sideStyles]
  );

  const handleStyleChange = useCallback(
    (v: string) => { onStyleChange("border-style", v); },
    [onStyleChange]
  );

  const handleGradientChange = useCallback(
    (css: string) => { onStyleChange("border-image-source", css); },
    [onStyleChange]
  );

  const switchToGradient = useCallback(() => {
    // border-image only paints when there's a visible solid border to fill.
    if (borderStyle === "none") onStyleChange("border-style", "solid");
    if (sideWidths.every((w) => parsePx(w) === 0)) onStyleChange("border-width", "2px");
    onStyleChange("border-image-slice", "1");
    onStyleChange("border-image-source", buildGradient(defaultGradient(borderColor)));
  }, [borderStyle, sideWidths, borderColor, onStyleChange]);

  const handleRemove = useCallback(() => {
    // Clear the border entirely — width, style, and any gradient stroke.
    onStyleChange("border-image-source", "none");
    onStyleChange("border-style", "none");
    onStyleChange("border-width", "0px");
  }, [onStyleChange]);

  const switchToSolid = useCallback(() => {
    // Promote the gradient's first stop to a flat border color, then drop it.
    const parsed = parseGradient(borderImage);
    const firstColor = parsed?.stops[0]?.color;
    onStyleChange("border-image-source", "none");
    if (firstColor) onStyleChange("border-color", firstColor);
  }, [borderImage, onStyleChange]);

  return (
    <div className="pd-section" style={{ position: "relative" }}>
      {/* Header with gear in the title area like Typography */}
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Stroke</span>
        <div className="pd-typography__header-actions" onClick={(e) => e.stopPropagation()}>
          <button
            ref={gearRef}
            className={`pd-section__icon-btn${popoverOpen ? " pd-section__icon-btn--active" : ""}`}
            type="button"
            title="Stroke options"
            onClick={() => setPopoverOpen((o) => !o)}
          >
            <GearIcon size={14} />
          </button>
          {collapsed && !hasValue ? (
            <button
              className="pd-section__plus-btn"
              onClick={(e) => { e.stopPropagation(); setCollapsed(false); }}
              type="button"
            >
              <PlusIcon size={12} />
            </button>
          ) : (
            <>
              {hasValue && (
                <button
                  className="pd-section__minus-btn"
                  onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                  type="button"
                  title="Remove stroke"
                >
                  <MinusIcon size={12} />
                </button>
              )}
              <span className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}>
                <ChevronDown size={12} />
              </span>
            </>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="pd-section__content">
          {/* Solid / Gradient toggle */}
          <div className="pd-fill__type-toggle">
            <button
              type="button"
              className={`pd-fill__type-btn${!hasGradient ? " pd-fill__type-btn--active" : ""}`}
              onClick={() => { if (hasGradient) switchToSolid(); }}
            >
              Solid
            </button>
            <button
              type="button"
              className={`pd-fill__type-btn${hasGradient ? " pd-fill__type-btn--active" : ""}`}
              onClick={() => { if (!hasGradient) switchToGradient(); }}
            >
              Gradient
            </button>
          </div>

          {/* Color (solid) or gradient editor */}
          {hasGradient ? (
            <GradientEditor
              value={borderImage}
              onChange={handleGradientChange}
              designTokens={designTokens}
              pageColors={pageColors}
            />
          ) : (
            mode === "single" ? (
              <div className="pd-section__row pd-section__row--half">
                <ColorPicker
                  value={borderColor}
                  onChange={handleColorChange}
                  pageColors={pageColors}
                />
                <NumberInput
                  value={parsePx(sideWidths[0])}
                  onChange={handleWidthChange}
                  min={0}
                  suffix="px"
                  suggestions={pageStrokeWidths}
                />
              </div>
            ) : (
              <div className="pd-section__row">
                <ColorPicker
                  value={borderColor}
                  onChange={handleColorChange}
                  pageColors={pageColors}
                />
              </div>
            )
          )}

          {/* Width controls in sides mode (shown for both solid and gradient) */}
          {mode === "sides" && (
            <>
              <div className="pd-section__row pd-section__row--half">
                <NumberInput label="T" value={parsePx(sideWidths[0])} onChange={(v) => handleSideWidthChange(0, v)} min={0} suffix="px" suggestions={pageStrokeWidths} />
                <NumberInput label="R" value={parsePx(sideWidths[1])} onChange={(v) => handleSideWidthChange(1, v)} min={0} suffix="px" suggestions={pageStrokeWidths} />
              </div>
              <div className="pd-section__row pd-section__row--half">
                <NumberInput label="B" value={parsePx(sideWidths[2])} onChange={(v) => handleSideWidthChange(2, v)} min={0} suffix="px" suggestions={pageStrokeWidths} />
                <NumberInput label="L" value={parsePx(sideWidths[3])} onChange={(v) => handleSideWidthChange(3, v)} min={0} suffix="px" suggestions={pageStrokeWidths} />
              </div>
            </>
          )}

          {/* Width control in single mode when a gradient is active (no color picker pairing) */}
          {mode === "single" && hasGradient && (
            <div className="pd-section__row pd-section__row--half">
              <NumberInput
                label="W"
                value={parsePx(sideWidths[0])}
                onChange={handleWidthChange}
                min={0}
                suffix="px"
                suggestions={pageStrokeWidths}
              />
              <span />
            </div>
          )}

          <VarLabel authoredStyles={authoredStyles} property={["border-color", "border-top-color"]} />
        </div>
      )}

      {/* Advanced options popover — stroke type + width mode */}
      {popoverOpen && (
        <div className="pd-spacing__popover pd-stroke__popover" ref={popoverRef}>
          <div className="pd-spacing__popover-title">Stroke Type</div>
          <div style={{ marginBottom: 10 }}>
            <SelectDropdown
              value={borderStyle}
              options={BORDER_STYLE_OPTIONS}
              onChange={handleStyleChange}
            />
          </div>
          <div className="pd-spacing__popover-title">Stroke Width</div>
          <label className="pd-spacing__popover-option" onClick={() => selectMode("single")}>
            <span className={`pd-spacing__radio${mode === "single" ? " pd-spacing__radio--active" : ""}`} />
            One value for all sides
          </label>
          <label className="pd-spacing__popover-option" onClick={() => selectMode("sides")}>
            <span className={`pd-spacing__radio${mode === "sides" ? " pd-spacing__radio--active" : ""}`} />
            Top / Right / Bottom / Left
          </label>
        </div>
      )}
    </div>
  );
};
