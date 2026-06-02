import React, { useState, useCallback, useRef, useEffect } from "react";
import { ColorPicker, GradientEditor } from "../controls";
import { VarLabel } from "./VarLabel";
import { ChevronDown, PlusIcon, EyeIcon, EyeOffIcon } from "../icons";
import { isGradient, parseGradient, buildGradient, defaultGradient } from "../../shared/gradient";
import "./sections.css";

interface FillSectionProps {
  computedStyles: Record<string, string>;
  authoredStyles?: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
  disabled?: boolean;
  isSvg?: boolean;
  designTokens?: Array<{ name: string; value: string }>;
  pageColors?: string[];
}

export const FillSection: React.FC<FillSectionProps> = ({
  computedStyles,
  authoredStyles,
  onStyleChange,
  disabled: sectionDisabled,
  isSvg,
  designTokens,
  pageColors,
}) => {
  const [disabled, setDisabled] = useState(false);
  const savedColorRef = useRef<string>("");
  const savedGradientRef = useRef<string>("");

  // SVG elements use `fill` (with "none" as the empty value).
  // HTML elements use `background-color` (with transparent as the empty value)
  // plus `background-image` for gradients.
  const colorProp = isSvg ? "fill" : "background-color";
  const emptyValue = isSvg ? "none" : "rgba(0, 0, 0, 0)";
  const bgColor = computedStyles[colorProp] || emptyValue;
  const bgImage = isSvg ? "none" : computedStyles["background-image"] || "none";
  const hasGradient = !isSvg && isGradient(bgImage);
  const hasSolidFill =
    bgColor !== "none" && bgColor !== "transparent" && bgColor !== "rgba(0, 0, 0, 0)";
  const hasValue = hasSolidFill || hasGradient;
  const [collapsed, setCollapsed] = useState(!hasValue);
  useEffect(() => {
    setCollapsed(!hasValue);
  }, [hasValue]);

  // Gradients are only supported on HTML elements (via background-image).
  const supportsGradient = !isSvg;

  const handleColorChange = useCallback(
    (v: string) => {
      // When setting a solid color, clear gradient (HTML only — SVG has no gradient here)
      if (hasGradient) {
        onStyleChange("background-image", "none");
      }
      onStyleChange(colorProp, v);
    },
    [onStyleChange, hasGradient, colorProp]
  );

  const handleGradientChange = useCallback(
    (css: string) => {
      onStyleChange("background-image", css);
    },
    [onStyleChange]
  );

  const switchToGradient = useCallback(() => {
    const seed = hasSolidFill ? bgColor : "#4f9eff";
    onStyleChange("background-image", buildGradient(defaultGradient(seed)));
  }, [hasSolidFill, bgColor, onStyleChange]);

  const switchToSolid = useCallback(() => {
    // Promote the gradient's first stop to a solid fill, then drop the gradient.
    const parsed = parseGradient(bgImage);
    const firstColor = parsed?.stops[0]?.color;
    onStyleChange("background-image", "none");
    if (firstColor) onStyleChange(colorProp, firstColor);
  }, [bgImage, colorProp, onStyleChange]);

  const handleToggleVisibility = useCallback(() => {
    if (disabled) {
      if (savedGradientRef.current) {
        onStyleChange("background-image", savedGradientRef.current);
      }
      onStyleChange(colorProp, savedColorRef.current || bgColor);
      setDisabled(false);
    } else {
      savedColorRef.current = bgColor;
      savedGradientRef.current = hasGradient ? bgImage : "";
      onStyleChange(colorProp, emptyValue);
      if (hasGradient) onStyleChange("background-image", "none");
      setDisabled(true);
    }
  }, [disabled, bgColor, bgImage, hasGradient, onStyleChange, colorProp, emptyValue]);

  return (
    <div className={`pd-section${sectionDisabled ? " pd-section--disabled" : ""}`}>
      <div className="pd-section__header" onClick={() => setCollapsed((c) => !c)}>
        <span className="pd-section__title">Fill{sectionDisabled ? " (N/A)" : ""}</span>
        {collapsed && !hasValue ? (
          <button
            className="pd-section__plus-btn"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed(false);
            }}
            type="button"
          >
            <PlusIcon size={12} />
          </button>
        ) : (
          <span className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}>
            <ChevronDown size={12} />
          </span>
        )}
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          {/* Solid / Gradient toggle (HTML only) */}
          {supportsGradient && (
            <div className="pd-fill__type-toggle">
              <button
                type="button"
                className={`pd-fill__type-btn${!hasGradient ? " pd-fill__type-btn--active" : ""}`}
                onClick={() => {
                  if (hasGradient) switchToSolid();
                }}
              >
                Solid
              </button>
              <button
                type="button"
                className={`pd-fill__type-btn${hasGradient ? " pd-fill__type-btn--active" : ""}`}
                onClick={() => {
                  if (!hasGradient) switchToGradient();
                }}
              >
                Gradient
              </button>
            </div>
          )}

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
                  {disabled ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                </button>
              </div>
              {!disabled && (
                <GradientEditor
                  value={bgImage}
                  onChange={handleGradientChange}
                  designTokens={designTokens}
                  pageColors={pageColors}
                />
              )}
            </>
          ) : (
            <>
              <div className="pd-section__row">
                <ColorPicker
                  value={bgColor}
                  onChange={handleColorChange}
                  designTokens={designTokens}
                  pageColors={pageColors}
                />
                <button
                  className={`pd-section__icon-btn${disabled ? " pd-section__icon-btn--disabled" : ""}`}
                  onClick={handleToggleVisibility}
                  type="button"
                  title={disabled ? "Show fill" : "Hide fill"}
                >
                  {disabled ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                </button>
              </div>
              <VarLabel authoredStyles={authoredStyles} property={colorProp} />
            </>
          )}
        </div>
      )}
    </div>
  );
};
