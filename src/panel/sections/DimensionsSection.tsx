import React, { useState, useCallback } from "react";
import { UnitInput } from "../controls";
import "./sections.css";

interface DimensionsSectionProps {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

export const DimensionsSection: React.FC<DimensionsSectionProps> = ({
  computedStyles,
  onStyleChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);

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
              value={computedStyles["width"] || "auto"}
              onChange={handleWidthChange}
              label="W"
            />
            <UnitInput
              value={computedStyles["height"] || "auto"}
              onChange={handleHeightChange}
              label="H"
            />
          </div>
        </div>
      )}
    </div>
  );
};
