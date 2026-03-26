import React, { useState, useCallback } from "react";
import { UnitInput } from "../controls";
import "./sections.css";

interface DimensionsSectionProps {
  computedStyles: Record<string, string>;
  authoredStyles?: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

/** Use authored value if it has a non-px unit, otherwise fall back to computed */
function preferAuthored(authored: string | undefined, computed: string | undefined): string {
  if (authored && authored !== "0" && authored !== "") return authored;
  return computed || "auto";
}

export const DimensionsSection: React.FC<DimensionsSectionProps> = ({
  computedStyles,
  authoredStyles,
  onStyleChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const width = preferAuthored(authoredStyles?.["width"], computedStyles["width"]);
  const height = preferAuthored(authoredStyles?.["height"], computedStyles["height"]);

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
