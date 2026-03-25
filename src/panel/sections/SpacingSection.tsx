import React, { useState, useCallback, useEffect } from "react";
import { UnitInput } from "../controls";
import "./sections.css";

interface SpacingSectionProps {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

export const SpacingSection: React.FC<SpacingSectionProps> = ({
  computedStyles,
  onStyleChange,
}) => {
  const spacingProps = ["padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top", "margin-right", "margin-bottom", "margin-left"];
  const hasValue = spacingProps.some((p) => {
    const v = computedStyles[p] || "0px";
    return v !== "0px" && v !== "0";
  });
  const [collapsed, setCollapsed] = useState(!hasValue);
  useEffect(() => { setCollapsed(!hasValue); }, [hasValue]);

  const handleChange = useCallback(
    (property: string) => (v: string) => onStyleChange(property, v),
    [onStyleChange]
  );

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Spacing</span>
        {collapsed && !hasValue ? (
          <button className="pd-section__plus-btn" onClick={(e) => { e.stopPropagation(); setCollapsed(false); }} type="button">+</button>
        ) : (
          <span className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}>&#9662;</span>
        )}
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          <span className="pd-section__label">Padding</span>
          <div className="pd-section__row pd-section__row--half">
            <UnitInput
              value={computedStyles["padding-top"] || "0px"}
              onChange={handleChange("padding-top")}
              label="T"
            />
            <UnitInput
              value={computedStyles["padding-right"] || "0px"}
              onChange={handleChange("padding-right")}
              label="R"
            />
          </div>
          <div className="pd-section__row pd-section__row--half">
            <UnitInput
              value={computedStyles["padding-bottom"] || "0px"}
              onChange={handleChange("padding-bottom")}
              label="B"
            />
            <UnitInput
              value={computedStyles["padding-left"] || "0px"}
              onChange={handleChange("padding-left")}
              label="L"
            />
          </div>
          <span className="pd-section__label">Margin</span>
          <div className="pd-section__row pd-section__row--half">
            <UnitInput
              value={computedStyles["margin-top"] || "0px"}
              onChange={handleChange("margin-top")}
              label="T"
            />
            <UnitInput
              value={computedStyles["margin-right"] || "0px"}
              onChange={handleChange("margin-right")}
              label="R"
            />
          </div>
          <div className="pd-section__row pd-section__row--half">
            <UnitInput
              value={computedStyles["margin-bottom"] || "0px"}
              onChange={handleChange("margin-bottom")}
              label="B"
            />
            <UnitInput
              value={computedStyles["margin-left"] || "0px"}
              onChange={handleChange("margin-left")}
              label="L"
            />
          </div>
        </div>
      )}
    </div>
  );
};
