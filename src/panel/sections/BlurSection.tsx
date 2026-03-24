import React, { useState, useCallback } from "react";
import { SliderInput } from "../controls";
import "./sections.css";

interface BlurSectionProps {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

function parseBlurFromFilter(filter: string): number {
  if (!filter || filter === "none") return 0;
  const match = filter.match(/blur\(\s*([\d.]+)px\s*\)/);
  if (match) return parseFloat(match[1]);
  return 0;
}

export const BlurSection: React.FC<BlurSectionProps> = ({
  computedStyles,
  onStyleChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const blurValue = parseBlurFromFilter(computedStyles["filter"] || "none");

  const handleChange = useCallback(
    (v: number) => {
      onStyleChange("filter", v > 0 ? `blur(${v}px)` : "none");
    },
    [onStyleChange]
  );

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Blur</span>
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
              value={blurValue}
              onChange={handleChange}
              min={0}
              max={50}
              step={1}
              suffix="px"
            />
          </div>
        </div>
      )}
    </div>
  );
};
