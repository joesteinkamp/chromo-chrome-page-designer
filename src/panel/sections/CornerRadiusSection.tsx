import React, { useState, useCallback, useEffect } from "react";
import { CornerRadiusInput } from "../controls";
import { ChevronDown, PlusIcon, MinusIcon } from "../icons";
import { isMixedValue } from "../controls/mixed";
import "./sections.css";

interface CornerRadiusSectionProps {
  computedStyles: Record<string, string>;
  authoredStyles?: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
  pageValues?: number[];
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
  pageValues,
}) => {
  const values: [string, string, string, string] = [
    computedStyles["border-top-left-radius"] || "0px",
    computedStyles["border-top-right-radius"] || "0px",
    computedStyles["border-bottom-right-radius"] || "0px",
    computedStyles["border-bottom-left-radius"] || "0px",
  ];
  const hasValue = values.some((v) => v !== "0px" && v !== "0");
  const [collapsed, setCollapsed] = useState(!hasValue);
  useEffect(() => { setCollapsed(!hasValue); }, [hasValue]);

  const handleChange = useCallback(
    (newValues: [string, string, string, string]) => {
      const allSame =
        newValues[0] === newValues[1] &&
        newValues[1] === newValues[2] &&
        newValues[2] === newValues[3];

      if (allSame && !isMixedValue(newValues[0])) {
        // Use shorthand
        onStyleChange("border-radius", newValues[0]);
      } else {
        // Set individual properties. Corners the multi-selection disagrees on
        // carry the Mixed sentinel — never write that back as CSS.
        CORNER_PROPS.forEach((prop, i) => {
          if (isMixedValue(newValues[i])) return;
          onStyleChange(prop, newValues[i]);
        });
      }
    },
    [onStyleChange]
  );

  const handleRemove = useCallback(
    () => onStyleChange("border-radius", "0px"),
    [onStyleChange]
  );

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Corner Radius</span>
        {collapsed && !hasValue ? (
          <button className="pd-section__plus-btn" onClick={(e) => { e.stopPropagation(); setCollapsed(false); }} type="button"><PlusIcon size={12} /></button>
        ) : (
          <div className="pd-section__header-actions">
            {hasValue && (
              <button className="pd-section__minus-btn" onClick={(e) => { e.stopPropagation(); handleRemove(); }} type="button" title="Remove corner radius"><MinusIcon size={12} /></button>
            )}
            <span className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}><ChevronDown size={12} /></span>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          <CornerRadiusInput values={values} onChange={handleChange} pageValues={pageValues} />
        </div>
      )}
    </div>
  );
};
