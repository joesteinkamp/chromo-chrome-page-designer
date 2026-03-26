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
 * If an explicit authored value with a non-px unit exists (%, rem, vw, auto),
 * show that. Otherwise show the computed px value so the user sees the
 * actual rendered size.
 */
function displayValue(authored: string | undefined, computed: string | undefined): string {
  if (authored) {
    const trimmed = authored.trim();
    if (trimmed === "auto" || trimmed === "fit-content" || trimmed === "min-content" || trimmed === "max-content") return trimmed;
    if (/(%|rem|em|vw|vh|vmin|vmax|ch|ex)/.test(trimmed)) return trimmed;
    // Authored px value — use it directly
    if (/\d+(\.\d+)?px$/.test(trimmed)) return trimmed;
  }
  // No authored value or no useful unit — show computed for display
  return computed || "auto";
}

export const DimensionsSection: React.FC<DimensionsSectionProps> = ({
  computedStyles,
  authoredStyles,
  onStyleChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const width = displayValue(authoredStyles?.["width"], computedStyles["width"]);
  const height = displayValue(authoredStyles?.["height"], computedStyles["height"]);

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
