import React, { useState, useCallback } from "react";
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

function parsePx(val: string): number {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
}

export const StrokeSection: React.FC<StrokeSectionProps> = ({
  computedStyles,
  onStyleChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const borderColor = computedStyles["border-top-color"] || "rgb(0, 0, 0)";
  const borderWidth = parsePx(computedStyles["border-top-width"] || "0px");
  const borderStyle = computedStyles["border-top-style"] || "none";

  const handleColorChange = useCallback(
    (v: string) => {
      onStyleChange("border-color", v);
    },
    [onStyleChange]
  );

  const handleWidthChange = useCallback(
    (v: number) => {
      onStyleChange("border-width", `${v}px`);
    },
    [onStyleChange]
  );

  const handleStyleChange = useCallback(
    (v: string) => {
      onStyleChange("border-style", v);
    },
    [onStyleChange]
  );

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Stroke</span>
        <span
          className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}
        >
          &#9662;
        </span>
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
            <NumberInput
              value={borderWidth}
              onChange={handleWidthChange}
              label="Width"
              min={0}
              suffix="px"
            />
            <SelectDropdown
              value={borderStyle}
              options={BORDER_STYLE_OPTIONS}
              onChange={handleStyleChange}
            />
          </div>
        </div>
      )}
    </div>
  );
};
