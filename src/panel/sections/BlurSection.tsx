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
  const match = filter.match(/(?:^|\s)blur\(\s*([\d.]+)px\s*\)/);
  if (match) return parseFloat(match[1]);
  return 0;
}

/**
 * Replace only the blur() term in a filter list, preserving everything else
 * (glassmorphism backdrops are commonly "blur(...) saturate(...)" — a slider
 * tick must not destroy the saturate).
 */
function withBlur(existing: string, px: number): string {
  const base =
    !existing || existing === "none" || isMixedValue(existing)
      ? ""
      : existing.replace(/(?:^|\s)blur\(\s*[\d.]+px\s*\)/, "").trim();
  const blurTerm = px > 0 ? `blur(${px}px)` : "";
  const combined = [blurTerm, base].filter(Boolean).join(" ").trim();
  return combined || "none";
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
      onStyleChange("filter", withBlur(computedStyles["filter"] || "none", v));
    },
    [onStyleChange, computedStyles]
  );

  const handleBackdropChange = useCallback(
    (v: number) => {
      onStyleChange(
        "backdrop-filter",
        withBlur(computedStyles["backdrop-filter"] || "none", v)
      );
    },
    [onStyleChange, computedStyles]
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
              label="Background"
              suffix="px"
            />
          </div>
        </div>
      )}
    </div>
  );
};
