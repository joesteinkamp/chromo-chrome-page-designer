import React, { useState, useCallback, useRef, useEffect } from "react";
import { ColorPicker, SliderInput } from "../controls";
import { VarLabel } from "./VarLabel";
import "./sections.css";

interface FillSectionProps {
  computedStyles: Record<string, string>;
  authoredStyles?: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
  disabled?: boolean;
  designTokens?: Array<{ name: string; value: string }>;
}

function parseOpacityFromColor(color: string): number {
  const rgbaMatch = color.match(
    /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (rgbaMatch && rgbaMatch[1] !== undefined) {
    return Math.round(parseFloat(rgbaMatch[1]) * 100);
  }
  if (color === "transparent") return 0;
  return 100;
}

function setAlphaInColor(color: string, alpha: number): string {
  const rgbMatch = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+)?\s*\)/
  );
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return alpha < 1
      ? `rgba(${r}, ${g}, ${b}, ${alpha})`
      : `rgb(${r}, ${g}, ${b})`;
  }
  return color;
}

function isGradient(value: string): boolean {
  return /gradient\(/.test(value);
}

export const FillSection: React.FC<FillSectionProps> = ({
  computedStyles,
  authoredStyles,
  onStyleChange,
  disabled: sectionDisabled,
  designTokens,
}) => {
  const [disabled, setDisabled] = useState(false);
  const savedColorRef = useRef<string>("");
  const savedGradientRef = useRef<string>("");

  const bgColor = computedStyles["background-color"] || "rgba(0, 0, 0, 0)";
  const bgImage = computedStyles["background-image"] || "none";
  const hasGradient = isGradient(bgImage);
  const hasSolidFill = bgColor !== "transparent" && bgColor !== "rgba(0, 0, 0, 0)";
  const hasValue = hasSolidFill || hasGradient;
  const [collapsed, setCollapsed] = useState(!hasValue);
  useEffect(() => { setCollapsed(!hasValue); }, [hasValue]);
  const opacity = parseOpacityFromColor(bgColor);

  const handleColorChange = useCallback(
    (v: string) => {
      // When setting a solid color, clear gradient
      if (hasGradient) {
        onStyleChange("background-image", "none");
      }
      onStyleChange("background-color", v);
    },
    [onStyleChange, hasGradient]
  );

  const handleOpacityChange = useCallback(
    (v: number) => {
      const alpha = v / 100;
      const newColor = setAlphaInColor(bgColor, alpha);
      onStyleChange("background-color", newColor);
    },
    [bgColor, onStyleChange]
  );

  const handleToggleVisibility = useCallback(() => {
    if (disabled) {
      if (savedGradientRef.current) {
        onStyleChange("background-image", savedGradientRef.current);
      }
      onStyleChange("background-color", savedColorRef.current || bgColor);
      setDisabled(false);
    } else {
      savedColorRef.current = bgColor;
      savedGradientRef.current = hasGradient ? bgImage : "";
      onStyleChange("background-color", "transparent");
      if (hasGradient) onStyleChange("background-image", "none");
      setDisabled(true);
    }
  }, [disabled, bgColor, bgImage, hasGradient, onStyleChange]);

  return (
    <div className={`pd-section${sectionDisabled ? " pd-section--disabled" : ""}`}>
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Fill{sectionDisabled ? " (N/A)" : ""}</span>
        {collapsed && !hasValue ? (
          <button className="pd-section__plus-btn" onClick={(e) => { e.stopPropagation(); setCollapsed(false); }} type="button">+</button>
        ) : (
          <span className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}>&#9662;</span>
        )}
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          {hasGradient ? (
            <>
              <div className="pd-section__row">
                <div
                  className="pd-fill__gradient-swatch"
                  style={{ background: bgImage }}
                  title={bgImage}
                />
                <button
                  className={`pd-section__icon-btn${disabled ? " pd-section__icon-btn--disabled" : ""}`}
                  onClick={handleToggleVisibility}
                  type="button"
                  title={disabled ? "Show fill" : "Hide fill"}
                >
                  {disabled ? "\u{1F441}\u{200D}\u{1F5E8}" : "\u{1F441}"}
                </button>
              </div>
              <div className="pd-fill__gradient-label">Gradient</div>
            </>
          ) : (
            <>
              <div className="pd-section__row">
                <ColorPicker
                  value={bgColor}
                  onChange={handleColorChange}
                  label="Color"
                  designTokens={designTokens}
                />
                <button
                  className={`pd-section__icon-btn${disabled ? " pd-section__icon-btn--disabled" : ""}`}
                  onClick={handleToggleVisibility}
                  type="button"
                  title={disabled ? "Show fill" : "Hide fill"}
                >
                  {disabled ? "\u{1F441}\u{200D}\u{1F5E8}" : "\u{1F441}"}
                </button>
              </div>
              <VarLabel authoredStyles={authoredStyles} property="background-color" />
              <div className="pd-section__row">
                <SliderInput
                  value={opacity}
                  onChange={handleOpacityChange}
                  min={0}
                  max={100}
                  step={1}
                  label="Opacity"
                  suffix="%"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
