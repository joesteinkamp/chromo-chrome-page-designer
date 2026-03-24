import React, { useState, useCallback } from "react";
import {
  DirectionToggle,
  AlignmentGrid,
  NumberInput,
} from "../controls";
import "./sections.css";

interface AutoLayoutSectionProps {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

function parseGap(val: string): number {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
}

export const AutoLayoutSection: React.FC<AutoLayoutSectionProps> = ({
  computedStyles,
  onStyleChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const display = computedStyles["display"] || "";
  const isFlex = display === "flex" || display === "inline-flex";

  const handleDirectionChange = useCallback(
    (v: string) => onStyleChange("flex-direction", v),
    [onStyleChange]
  );

  const handleAlignmentChange = useCallback(
    (justify: string, align: string) => {
      onStyleChange("justify-content", justify);
      onStyleChange("align-items", align);
    },
    [onStyleChange]
  );

  const handleGapChange = useCallback(
    (v: number) => onStyleChange("gap", `${v}px`),
    [onStyleChange]
  );

  const handleWrapToggle = useCallback(() => {
    const current = computedStyles["flex-wrap"] || "nowrap";
    onStyleChange("flex-wrap", current === "wrap" ? "nowrap" : "wrap");
  }, [computedStyles, onStyleChange]);

  const handleAddAutoLayout = useCallback(() => {
    onStyleChange("display", "flex");
  }, [onStyleChange]);

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Auto Layout</span>
        <span
          className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}
        >
          &#9662;
        </span>
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          {!isFlex ? (
            <button
              className="pd-section__add-btn"
              onClick={handleAddAutoLayout}
              type="button"
            >
              + Add auto layout
            </button>
          ) : (
            <>
              <div className="pd-section__row">
                <DirectionToggle
                  value={computedStyles["flex-direction"] || "row"}
                  onChange={handleDirectionChange}
                />
              </div>
              <div className="pd-section__row">
                <AlignmentGrid
                  justifyContent={computedStyles["justify-content"] || "flex-start"}
                  alignItems={computedStyles["align-items"] || "flex-start"}
                  onChange={handleAlignmentChange}
                />
              </div>
              <div className="pd-section__row">
                <NumberInput
                  value={parseGap(computedStyles["gap"] || "0")}
                  onChange={handleGapChange}
                  label="Gap"
                  min={0}
                  suffix="px"
                />
                <button
                  className={`pd-section__toggle-btn${(computedStyles["flex-wrap"] || "nowrap") === "wrap" ? " pd-section__toggle-btn--active" : ""}`}
                  onClick={handleWrapToggle}
                  type="button"
                  title="Toggle flex-wrap"
                >
                  Wrap
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
