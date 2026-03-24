import React, { useState, useCallback } from "react";
import { CornerRadiusInput } from "../controls";
import "./sections.css";

interface CornerRadiusSectionProps {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

const CORNER_PROPS = [
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
] as const;

export const CornerRadiusSection: React.FC<CornerRadiusSectionProps> = ({
  computedStyles,
  onStyleChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const values: [string, string, string, string] = [
    computedStyles["border-top-left-radius"] || "0px",
    computedStyles["border-top-right-radius"] || "0px",
    computedStyles["border-bottom-right-radius"] || "0px",
    computedStyles["border-bottom-left-radius"] || "0px",
  ];

  const handleChange = useCallback(
    (newValues: [string, string, string, string]) => {
      const allSame =
        newValues[0] === newValues[1] &&
        newValues[1] === newValues[2] &&
        newValues[2] === newValues[3];

      if (allSame) {
        // Use shorthand
        onStyleChange("border-radius", newValues[0]);
      } else {
        // Set individual properties
        CORNER_PROPS.forEach((prop, i) => {
          onStyleChange(prop, newValues[i]);
        });
      }
    },
    [onStyleChange]
  );

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Corner Radius</span>
        <span
          className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}
        >
          &#9662;
        </span>
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          <CornerRadiusInput values={values} onChange={handleChange} />
        </div>
      )}
    </div>
  );
};
