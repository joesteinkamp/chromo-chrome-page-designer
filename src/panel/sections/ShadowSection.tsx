import React, { useState, useCallback, useMemo, useEffect } from "react";
import { NumberInput, ColorPicker } from "../controls";
import { ChevronDown, PlusIcon } from "../icons";
import "./sections.css";

interface ShadowSectionProps {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
  disabled?: boolean;
}

interface ShadowValues {
  inset: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}

const DEFAULT_SHADOW: ShadowValues = {
  inset: false,
  x: 0,
  y: 4,
  blur: 8,
  spread: 0,
  color: "rgba(0, 0, 0, 0.25)",
};

function parseBoxShadow(raw: string): ShadowValues {
  if (!raw || raw === "none") {
    return { ...DEFAULT_SHADOW, x: 0, y: 0, blur: 0, spread: 0 };
  }

  const trimmed = raw.trim();
  const result: ShadowValues = {
    inset: false,
    x: 0,
    y: 0,
    blur: 0,
    spread: 0,
    color: "rgba(0, 0, 0, 0.25)",
  };

  // Check for inset
  let working = trimmed;
  if (working.startsWith("inset")) {
    result.inset = true;
    working = working.slice(5).trim();
  }

  // Extract color — could be at the start or end
  // Try to extract rgb/rgba/hsl/hsla/hex color
  let colorStr = "";

  // Match rgba(...) or rgb(...)
  const rgbaMatch = working.match(/rgba?\([^)]+\)/);
  if (rgbaMatch) {
    colorStr = rgbaMatch[0];
    working = working.replace(colorStr, "").trim();
  } else {
    // Match hex color
    const hexMatch = working.match(/#[0-9a-fA-F]{3,8}/);
    if (hexMatch) {
      colorStr = hexMatch[0];
      working = working.replace(colorStr, "").trim();
    }
  }

  if (colorStr) {
    result.color = colorStr;
  }

  // Check for trailing inset
  if (working.endsWith("inset")) {
    result.inset = true;
    working = working.slice(0, -5).trim();
  }

  // Remaining should be numeric values: x y blur? spread?
  const nums = working.split(/\s+/).map((s) => parseFloat(s));
  if (nums.length >= 1 && !isNaN(nums[0])) result.x = nums[0];
  if (nums.length >= 2 && !isNaN(nums[1])) result.y = nums[1];
  if (nums.length >= 3 && !isNaN(nums[2])) result.blur = nums[2];
  if (nums.length >= 4 && !isNaN(nums[3])) result.spread = nums[3];

  return result;
}

function composeShadow(s: ShadowValues): string {
  if (s.x === 0 && s.y === 0 && s.blur === 0 && s.spread === 0) {
    return "none";
  }
  const parts: string[] = [];
  if (s.inset) parts.push("inset");
  parts.push(`${s.x}px`);
  parts.push(`${s.y}px`);
  parts.push(`${s.blur}px`);
  parts.push(`${s.spread}px`);
  parts.push(s.color);
  return parts.join(" ");
}

export const ShadowSection: React.FC<ShadowSectionProps> = ({
  computedStyles,
  onStyleChange,
  disabled: sectionDisabled,
}) => {
  const rawShadow = computedStyles["box-shadow"] || "none";
  const hasValue = rawShadow !== "none";
  const [collapsed, setCollapsed] = useState(!hasValue);
  useEffect(() => { setCollapsed(!hasValue); }, [hasValue]);

  const shadow = useMemo(
    () => parseBoxShadow(computedStyles["box-shadow"] || "none"),
    [computedStyles]
  );

  const emit = useCallback(
    (updated: ShadowValues) => {
      onStyleChange("box-shadow", composeShadow(updated));
    },
    [onStyleChange]
  );

  const handleXChange = useCallback(
    (v: number) => emit({ ...shadow, x: v }),
    [shadow, emit]
  );
  const handleYChange = useCallback(
    (v: number) => emit({ ...shadow, y: v }),
    [shadow, emit]
  );
  const handleBlurChange = useCallback(
    (v: number) => emit({ ...shadow, blur: v }),
    [shadow, emit]
  );
  const handleSpreadChange = useCallback(
    (v: number) => emit({ ...shadow, spread: v }),
    [shadow, emit]
  );
  const handleColorChange = useCallback(
    (v: string) => emit({ ...shadow, color: v }),
    [shadow, emit]
  );
  const handleInsetToggle = useCallback(
    () => emit({ ...shadow, inset: !shadow.inset }),
    [shadow, emit]
  );

  return (
    <div className={`pd-section${sectionDisabled ? " pd-section--disabled" : ""}`}>
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Shadow{sectionDisabled ? " (N/A)" : ""}</span>
        {collapsed && !hasValue ? (
          <button className="pd-section__plus-btn" onClick={(e) => { e.stopPropagation(); setCollapsed(false); }} type="button"><PlusIcon size={12} /></button>
        ) : (
          <span className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}><ChevronDown size={12} /></span>
        )}
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          <div className="pd-section__row">
            <ColorPicker
              value={shadow.color}
              onChange={handleColorChange}
              label="Color"
            />
            <button
              className={`pd-section__toggle-btn${shadow.inset ? " pd-section__toggle-btn--active" : ""}`}
              onClick={handleInsetToggle}
              type="button"
              title={shadow.inset ? "Switch to drop shadow" : "Switch to inset shadow"}
            >
              {shadow.inset ? "Inset" : "Drop"}
            </button>
          </div>
          <div className="pd-section__row">
            <NumberInput
              value={shadow.x}
              onChange={handleXChange}
              label="X"
              suffix="px"
            />
            <NumberInput
              value={shadow.y}
              onChange={handleYChange}
              label="Y"
              suffix="px"
            />
          </div>
          <div className="pd-section__row">
            <NumberInput
              value={shadow.blur}
              onChange={handleBlurChange}
              label="Blur"
              min={0}
              suffix="px"
            />
            <NumberInput
              value={shadow.spread}
              onChange={handleSpreadChange}
              label="Spread"
              suffix="px"
            />
          </div>
        </div>
      )}
    </div>
  );
};
