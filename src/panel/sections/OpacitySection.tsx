import React, { useState, useCallback } from "react";
import { SliderInput } from "../controls";
import "./sections.css";

interface OpacitySectionProps {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

export const OpacitySection: React.FC<OpacitySectionProps> = ({
  computedStyles,
  onStyleChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const rawOpacity = parseFloat(computedStyles["opacity"] || "1");
  const opacityPercent = Math.round(
    (isNaN(rawOpacity) ? 1 : rawOpacity) * 100
  );

  const handleChange = useCallback(
    (v: number) => {
      onStyleChange("opacity", String(v / 100));
    },
    [onStyleChange]
  );

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Opacity</span>
        <span
          className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}
        >
          &#9662;
        </span>
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          <div className="pd-section__row">
            <SliderInput
              value={opacityPercent}
              onChange={handleChange}
              min={0}
              max={100}
              step={1}
              suffix="%"
            />
          </div>
        </div>
      )}
    </div>
  );
};
