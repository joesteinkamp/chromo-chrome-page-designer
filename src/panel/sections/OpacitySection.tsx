import React, { useState, useCallback, useEffect } from "react";
import { SliderInput, SelectDropdown } from "../controls";
import { ChevronDown, PlusIcon } from "../icons";
import { parseNumericValue } from "../controls/mixed";
import "./sections.css";

/** CSS mix-blend-mode values, ordered like Figma's blend menu */
const BLEND_MODE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "darken", label: "Darken" },
  { value: "multiply", label: "Multiply" },
  { value: "color-burn", label: "Color burn" },
  { value: "lighten", label: "Lighten" },
  { value: "screen", label: "Screen" },
  { value: "plus-lighter", label: "Plus lighter" },
  { value: "color-dodge", label: "Color dodge" },
  { value: "overlay", label: "Overlay" },
  { value: "soft-light", label: "Soft light" },
  { value: "hard-light", label: "Hard light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue" },
  { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosity" },
];

interface OpacitySectionProps {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

export const OpacitySection: React.FC<OpacitySectionProps> = ({
  computedStyles,
  onStyleChange,
}) => {
  // NaN = multi-selection "Mixed" — keep the section open, slider parks at 0
  const rawOpacity = parseNumericValue(computedStyles["opacity"] || "1", 1);
  const opacityPercent = Number.isNaN(rawOpacity)
    ? NaN
    : Math.round(rawOpacity * 100);
  const blendMode = computedStyles["mix-blend-mode"] || "normal";
  const hasValue =
    Number.isNaN(opacityPercent) || opacityPercent < 100 || blendMode !== "normal";
  const [collapsed, setCollapsed] = useState(!hasValue);
  useEffect(() => { setCollapsed(!hasValue); }, [hasValue]);

  const handleChange = useCallback(
    (v: number) => {
      onStyleChange("opacity", String(v / 100));
    },
    [onStyleChange]
  );

  const handleBlendChange = useCallback(
    (v: string) => {
      onStyleChange("mix-blend-mode", v);
    },
    [onStyleChange]
  );

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Appearance</span>
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
              value={opacityPercent}
              onChange={handleChange}
              min={0}
              max={100}
              step={1}
              suffix="%"
            />
          </div>
          <div className="pd-section__row">
            <SelectDropdown
              value={blendMode}
              options={BLEND_MODE_OPTIONS}
              onChange={handleBlendChange}
              label="Blend"
            />
          </div>
        </div>
      )}
    </div>
  );
};
