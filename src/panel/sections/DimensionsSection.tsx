import React, { useState, useCallback, useEffect } from "react";
import { UnitInput } from "../controls";
import { ChevronDown, LinkIcon, UnlinkIcon } from "../icons";
import "./sections.css";

interface DimensionsSectionProps {
  computedStyles: Record<string, string>;
  authoredStyles?: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
  /** Apply several properties as one undoable batch (aspect-lock co-write) */
  onStyleBatch?: (changes: Array<{ property: string; value: string }>) => void;
  /** Rendered size — the ratio source for the aspect lock */
  rect?: { width: number; height: number };
  /** Selector of the selected element — the lock resets when it changes */
  selector?: string;
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
  onStyleBatch,
  rect,
  selector,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  // Aspect lock (Figma's constrain-proportions link): editing W in px also
  // writes the proportional H, and vice versa, as ONE undoable batch. Ratio
  // comes from the live rendered rect. The lock is per-element intent — it
  // resets when the selection moves — and needs px/auto values (a
  // proportional counterpart for "50%" isn't well-defined).
  const [aspectLocked, setAspectLocked] = useState(false);
  useEffect(() => {
    setAspectLocked(false);
  }, [selector]);

  const width = displayValue(authoredStyles?.["width"]);
  const height = displayValue(authoredStyles?.["height"]);
  const minWidth = displayValue(authoredStyles?.["min-width"]);
  const maxWidth = displayValue(authoredStyles?.["max-width"]);
  const minHeight = displayValue(authoredStyles?.["min-height"]);
  const maxHeight = displayValue(authoredStyles?.["max-height"]);

  // The lock only makes sense over px (or auto) values — disable it rather
  // than silently not constraining when a %, rem, etc. is authored.
  const isPxOrAuto = (v: string) => v === "auto" || /^-?[\d.]+px$/.test(v.trim()) || v === "";
  const lockUsable = isPxOrAuto(width) && isPxOrAuto(height);

  const applyPair = useCallback(
    (first: { property: string; value: string }, second?: { property: string; value: string }) => {
      if (second && onStyleBatch) {
        onStyleBatch([first, second]);
        return;
      }
      onStyleChange(first.property, first.value);
      if (second) onStyleChange(second.property, second.value);
    },
    [onStyleBatch, onStyleChange]
  );

  const handleWidthChange = useCallback(
    (v: string) => {
      const px = /^(-?[\d.]+)px$/.exec(v.trim());
      if (aspectLocked && px && rect && rect.width > 0 && rect.height > 0) {
        const newH = Math.round((parseFloat(px[1]) * rect.height / rect.width) * 100) / 100;
        applyPair({ property: "width", value: v }, { property: "height", value: `${newH}px` });
        return;
      }
      onStyleChange("width", v);
    },
    [onStyleChange, applyPair, aspectLocked, rect]
  );

  const handleHeightChange = useCallback(
    (v: string) => {
      const px = /^(-?[\d.]+)px$/.exec(v.trim());
      if (aspectLocked && px && rect && rect.width > 0 && rect.height > 0) {
        const newW = Math.round((parseFloat(px[1]) * rect.width / rect.height) * 100) / 100;
        applyPair({ property: "height", value: v }, { property: "width", value: `${newW}px` });
        return;
      }
      onStyleChange("height", v);
    },
    [onStyleChange, applyPair, aspectLocked, rect]
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
              disabled={!lockUsable}
              title={
                !lockUsable
                  ? "Constrain proportions (needs px values)"
                  : aspectLocked
                    ? "Unconstrain proportions"
                    : "Constrain proportions"
              }
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
