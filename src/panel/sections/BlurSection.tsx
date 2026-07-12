import React, { useState, useCallback, useEffect } from "react";
import { SliderInput } from "../controls";
import { ChevronDown, PlusIcon } from "../icons";
import { isMixedValue } from "../controls/mixed";
import "./sections.css";

interface BlurSectionProps {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

function parseBlurFromFilter(filter: string): number {
  // NaN = multi-selection "Mixed" — NumberInput renders the placeholder
  if (isMixedValue(filter)) return NaN;
  if (!filter || filter === "none") return 0;
  const match = filter.match(/blur\(\s*([\d.]+)px\s*\)/);
  if (match) return parseFloat(match[1]);
  return 0;
}

export const BlurSection: React.FC<BlurSectionProps> = ({
  computedStyles,
  onStyleChange,
}) => {
  const blurValue = parseBlurFromFilter(computedStyles["filter"] || "none");
  // Backdrop blur = Figma's "Background blur" — blurs what's behind the box
  const backdropValue = parseBlurFromFilter(
    computedStyles["backdrop-filter"] || "none"
  );
  const hasValue =
    Number.isNaN(blurValue) ||
    blurValue > 0 ||
    Number.isNaN(backdropValue) ||
    backdropValue > 0;
  const [collapsed, setCollapsed] = useState(!hasValue);
  useEffect(() => { setCollapsed(!hasValue); }, [hasValue]);

  const handleChange = useCallback(
    (v: number) => {
      onStyleChange("filter", v > 0 ? `blur(${v}px)` : "none");
    },
    [onStyleChange]
  );

  const handleBackdropChange = useCallback(
    (v: number) => {
      onStyleChange("backdrop-filter", v > 0 ? `blur(${v}px)` : "none");
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
        {collapsed && !hasValue ? (
          <button className="pd-section__plus-btn" onClick={(e) => { e.stopPropagation(); setCollapsed(false); }} type="button"><PlusIcon size={12} /></button>
        ) : (
          <span className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}><ChevronDown size={12} /></span>
        )}
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
              label="Layer"
              suffix="px"
            />
          </div>
          <div className="pd-section__row">
            <SliderInput
              value={backdropValue}
              onChange={handleBackdropChange}
              min={0}
              max={50}
              step={1}
              label="Backdrop"
              suffix="px"
            />
          </div>
        </div>
      )}
    </div>
  );
};
