import React, { useState, useCallback } from "react";
import { UnitInput } from "../controls";
import "./sections.css";

interface DimensionsSectionProps {
  computedStyles: Record<string, string>;
  authoredStyles?: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

/**
 * Determine the display value for a dimension property.
 * If an explicit authored value exists (inline style set by user or CSS),
 * use it. Otherwise show "auto" — the actual rendered size is shown in
 * the element info header, not here.
 */
function displayValue(authored: string | undefined): string {
  if (!authored) return "auto";
  const trimmed = authored.trim();
  if (!trimmed) return "auto";
  return trimmed;
}

export const DimensionsSection: React.FC<DimensionsSectionProps> = ({
  computedStyles,
  authoredStyles,
  onStyleChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const width = displayValue(authoredStyles?.["width"]);
  const height = displayValue(authoredStyles?.["height"]);

  const handleWidthChange = useCallback(
    (v: string) => onStyleChange("width", v),
    [onStyleChange]
  );

  const handleHeightChange = useCallback(
    (v: string) => onStyleChange("height", v),
    [onStyleChange]
  );

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Dimensions</span>
        <span
          className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}
        >
          &#9662;
        </span>
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          <div className="pd-section__row pd-section__row--half">
            <UnitInput
              value={width}
              onChange={handleWidthChange}
              label="W"
            />
            <UnitInput
              value={height}
              onChange={handleHeightChange}
              label="H"
            />
          </div>
        </div>
      )}
    </div>
  );
};
