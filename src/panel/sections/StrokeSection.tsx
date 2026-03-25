import React, { useState, useCallback, useMemo, useEffect } from "react";
import { ColorPicker, NumberInput, SelectDropdown } from "../controls";
import "./sections.css";

interface StrokeSectionProps {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

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

const SIDE_LABELS = ["T", "R", "B", "L"] as const;

function parsePx(val: string): number {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
}

export const StrokeSection: React.FC<StrokeSectionProps> = ({
  computedStyles,
  onStyleChange,
}) => {
  const [linked, setLinked] = useState(true);

  const borderColor = computedStyles["border-top-color"] || "rgb(0, 0, 0)";
  const borderStyle = computedStyles["border-top-style"] || "none";

  const sideWidths: [string, string, string, string] = [
    computedStyles["border-top-width"] || "0px",
    computedStyles["border-right-width"] || "0px",
    computedStyles["border-bottom-width"] || "0px",
    computedStyles["border-left-width"] || "0px",
  ];

  const borderWidth = parsePx(sideWidths[0]);
  const hasValue = borderStyle !== "none" && borderWidth > 0;
  const [collapsed, setCollapsed] = useState(!hasValue);
  useEffect(() => { setCollapsed(!hasValue); }, [hasValue]);

  const allSame = useMemo(
    () =>
      sideWidths[0] === sideWidths[1] &&
      sideWidths[1] === sideWidths[2] &&
      sideWidths[2] === sideWidths[3],
    [sideWidths]
  );

  const ensureBorderStyle = useCallback(
    (width: number) => {
      if (width > 0 && borderStyle === "none") {
        onStyleChange("border-style", "solid");
      }
    },
    [borderStyle, onStyleChange]
  );

  const handleColorChange = useCallback(
    (v: string) => {
      onStyleChange("border-color", v);
    },
    [onStyleChange]
  );

  const handleLinkedWidthChange = useCallback(
    (v: number) => {
      ensureBorderStyle(v);
      onStyleChange("border-width", `${v}px`);
    },
    [onStyleChange, ensureBorderStyle]
  );

  const handleSideWidthChange = useCallback(
    (index: number, v: number) => {
      ensureBorderStyle(v);
      onStyleChange(SIDE_PROPS[index], `${v}px`);
    },
    [onStyleChange, ensureBorderStyle]
  );

  const handleStyleChange = useCallback(
    (v: string) => {
      onStyleChange("border-style", v);
    },
    [onStyleChange]
  );

  const toggleLinked = useCallback(() => {
    setLinked((prev) => !prev);
  }, []);

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
          <div className="pd-section__row">
            <SelectDropdown
              value={borderStyle}
              options={BORDER_STYLE_OPTIONS}
              onChange={handleStyleChange}
            />
          </div>
          <div className="pd-stroke">
            <div className="pd-stroke__linked-row">
              <button
                className={`pd-stroke__link-btn${linked ? " pd-stroke__link-btn--active" : ""}`}
                onClick={toggleLinked}
                type="button"
                title={linked ? "Unlink sides" : "Link sides"}
              >
                {linked ? "\u{1F517}" : "\u2022\u2022"}
              </button>
              {linked && (
                <NumberInput
                  value={parsePx(sideWidths[0])}
                  onChange={handleLinkedWidthChange}
                  min={0}
                  suffix="px"
                  label="Width"
                />
              )}
            </div>
            {!linked && (
              <div className="pd-stroke__unlinked">
                {SIDE_LABELS.map((label, i) => (
                  <NumberInput
                    key={label}
                    value={parsePx(sideWidths[i])}
                    onChange={(v) => handleSideWidthChange(i, v)}
                    min={0}
                    suffix="px"
                    label={label}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
