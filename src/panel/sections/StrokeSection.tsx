import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { ColorPicker, NumberInput, SelectDropdown } from "../controls";
import { VarLabel } from "./VarLabel";
import "./sections.css";

interface StrokeSectionProps {
  computedStyles: Record<string, string>;
  authoredStyles?: Record<string, string>;
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

const SIDE_LABELS = ["T", "R", "B", "L"] as const;

function parsePx(val: string): number {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
}

function detectMode(widths: string[]): StrokeMode {
  if (widths[0] === widths[1] && widths[1] === widths[2] && widths[2] === widths[3]) return "single";
  return "sides";
}

export const StrokeSection: React.FC<StrokeSectionProps> = ({
  computedStyles,
  authoredStyles,
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

  const hasValue = sideStyles.some((s, i) => s !== "none" && parsePx(sideWidths[i]) > 0);
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
    setPopoverOpen(false);
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

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Stroke</span>
        {collapsed && !hasValue ? (
          <button className="pd-section__plus-btn" onClick={(e) => { e.stopPropagation(); setCollapsed(false); }} type="button">+</button>
        ) : (
          <span className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}>&#9662;</span>
        )}
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          <div className="pd-section__row">
            <ColorPicker
              value={borderColor}
              onChange={handleColorChange}
              label="Color"
            />
          </div>
          <VarLabel authoredStyles={authoredStyles} property={["border-color", "border-top-color"]} />
          <div className="pd-section__row">
            <SelectDropdown
              value={borderStyle}
              options={BORDER_STYLE_OPTIONS}
              onChange={handleStyleChange}
            />
          </div>

          <div className="pd-spacing__group" style={{ position: "relative" }}>
            <div className="pd-spacing__group-header">
              <span className="pd-spacing__group-label">Width</span>
              <button
                ref={gearRef}
                className={`pd-section__icon-btn${popoverOpen ? " pd-section__icon-btn--active" : ""}`}
                type="button"
                title="Width options"
                onClick={() => setPopoverOpen((o) => !o)}
              >
                &#x2699;
              </button>
            </div>

            {mode === "single" && (
              <div className="pd-section__row">
                <NumberInput
                  value={parsePx(sideWidths[0])}
                  onChange={handleWidthChange}
                  min={0}
                  suffix="px"
                />
              </div>
            )}

            {mode === "sides" && (
              <>
                <div className="pd-section__row pd-section__row--half">
                  <NumberInput label="T" value={parsePx(sideWidths[0])} onChange={(v) => handleSideWidthChange(0, v)} min={0} suffix="px" />
                  <NumberInput label="R" value={parsePx(sideWidths[1])} onChange={(v) => handleSideWidthChange(1, v)} min={0} suffix="px" />
                </div>
                <div className="pd-section__row pd-section__row--half">
                  <NumberInput label="B" value={parsePx(sideWidths[2])} onChange={(v) => handleSideWidthChange(2, v)} min={0} suffix="px" />
                  <NumberInput label="L" value={parsePx(sideWidths[3])} onChange={(v) => handleSideWidthChange(3, v)} min={0} suffix="px" />
                </div>
              </>
            )}

            {popoverOpen && (
              <div className="pd-spacing__popover" ref={popoverRef}>
                <div className="pd-spacing__popover-title">Stroke Width</div>
                <label className="pd-spacing__popover-option" onClick={() => selectMode("single")}>
                  <span className={`pd-spacing__radio${mode === "single" ? " pd-spacing__radio--active" : ""}`} />
                  One value for all sides
                </label>
                <label className="pd-spacing__popover-option" onClick={() => selectMode("sides")}>
                  <span className={`pd-spacing__radio${mode === "sides" ? " pd-spacing__radio--active" : ""}`} />
                  Top/Right/Bottom/Left
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
