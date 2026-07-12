import React, { useState, useCallback } from "react";
import { UnitInput } from "../controls";
import { ChevronDown, LinkIcon, UnlinkIcon } from "../icons";
import "./sections.css";

interface DimensionsSectionProps {
  computedStyles: Record<string, string>;
  authoredStyles?: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
  /** Rendered size — the ratio source for the aspect lock */
  rect?: { width: number; height: number };
}

/**
 * Determine the display value for a dimension property.
 * If an explicit authored value exists (inline style set by user or CSS),
 * use it. Otherwise show "auto" — the actual rendered size is shown in
 * the element info header, not here.
 */
function displayValue(authored: string | undefined): string {
  if (!authored) return "auto";
  const trimmed = authored.trim();
  if (!trimmed) return "auto";
  return trimmed;
}

/**
 * The "no constraint" keyword for a min/max dimension. min-* defaults to
 * `auto` (resolves to 0 for non-flex items), max-* defaults to `none`.
 * UnitInput emits "auto" when its field is cleared, so we translate that
 * sentinel into the right keyword to actually drop the constraint — this
 * is what lets a user remove a max-width and let an element go full width.
 */
function noConstraintValue(kind: "min" | "max"): string {
  return kind === "min" ? "auto" : "none";
}

export const DimensionsSection: React.FC<DimensionsSectionProps> = ({
  computedStyles,
  authoredStyles,
  onStyleChange,
  rect,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  // Aspect lock (Figma's constrain-proportions link): editing W in px also
  // writes the proportional H, and vice versa. Ratio comes from the live
  // rendered rect. Non-px units pass through unconstrained — a proportional
  // counterpart for "50%" isn't well-defined.
  const [aspectLocked, setAspectLocked] = useState(false);

  const width = displayValue(authoredStyles?.["width"]);
  const height = displayValue(authoredStyles?.["height"]);
  const minWidth = displayValue(authoredStyles?.["min-width"]);
  const maxWidth = displayValue(authoredStyles?.["max-width"]);
  const minHeight = displayValue(authoredStyles?.["min-height"]);
  const maxHeight = displayValue(authoredStyles?.["max-height"]);

  const handleWidthChange = useCallback(
    (v: string) => {
      onStyleChange("width", v);
      const px = /^(-?[\d.]+)px$/.exec(v.trim());
      if (aspectLocked && px && rect && rect.width > 0 && rect.height > 0) {
        const newH = Math.round((parseFloat(px[1]) * rect.height / rect.width) * 100) / 100;
        onStyleChange("height", `${newH}px`);
      }
    },
    [onStyleChange, aspectLocked, rect]
  );

  const handleHeightChange = useCallback(
    (v: string) => {
      onStyleChange("height", v);
      const px = /^(-?[\d.]+)px$/.exec(v.trim());
      if (aspectLocked && px && rect && rect.width > 0 && rect.height > 0) {
        const newW = Math.round((parseFloat(px[1]) * rect.width / rect.height) * 100) / 100;
        onStyleChange("width", `${newW}px`);
      }
    },
    [onStyleChange, aspectLocked, rect]
  );

  /**
   * Clearing a constraint field yields "auto" from UnitInput; map it to the
   * property-appropriate no-constraint keyword so the limit is truly removed.
   */
  const handleConstraintChange = useCallback(
    (property: "min-width" | "max-width" | "min-height" | "max-height", v: string) => {
      const kind = property.startsWith("min") ? "min" : "max";
      const next = /^auto$/i.test(v.trim()) ? noConstraintValue(kind) : v;
      onStyleChange(property, next);
    },
    [onStyleChange]
  );

  const handleMinWidthChange = useCallback(
    (v: string) => handleConstraintChange("min-width", v),
    [handleConstraintChange]
  );
  const handleMaxWidthChange = useCallback(
    (v: string) => handleConstraintChange("max-width", v),
    [handleConstraintChange]
  );
  const handleMinHeightChange = useCallback(
    (v: string) => handleConstraintChange("min-height", v),
    [handleConstraintChange]
  );
  const handleMaxHeightChange = useCallback(
    (v: string) => handleConstraintChange("max-height", v),
    [handleConstraintChange]
  );

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Dimensions</span>
        <span
          className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}
        >
          <ChevronDown size={12} />
        </span>
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          <div className="pd-section__row pd-dimensions__wh">
            <UnitInput
              value={width}
              onChange={handleWidthChange}
              label="W"
            />
            <button
              className={`pd-corner-radius__link-btn${aspectLocked ? " pd-corner-radius__link-btn--active" : ""}`}
              onClick={() => setAspectLocked((l) => !l)}
              type="button"
              title={aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
            >
              {aspectLocked ? <LinkIcon size={14} /> : <UnlinkIcon size={14} />}
            </button>
            <UnitInput
              value={height}
              onChange={handleHeightChange}
              label="H"
            />
          </div>
          <div className="pd-section__row pd-section__row--half">
            <UnitInput
              value={minWidth}
              onChange={handleMinWidthChange}
              label="Min W"
            />
            <UnitInput
              value={minHeight}
              onChange={handleMinHeightChange}
              label="Min H"
            />
          </div>
          <div className="pd-section__row pd-section__row--half">
            <UnitInput
              value={maxWidth}
              onChange={handleMaxWidthChange}
              label="Max W"
            />
            <UnitInput
              value={maxHeight}
              onChange={handleMaxHeightChange}
              label="Max H"
            />
          </div>
        </div>
      )}
    </div>
  );
};
