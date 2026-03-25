import React, { useState, useCallback, useEffect } from "react";
import { NumberInput } from "../controls";
import "./sections.css";

interface SpacingSectionProps {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

const ALL_PROPS = [
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
];

function px(val: string | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

export const SpacingSection: React.FC<SpacingSectionProps> = ({
  computedStyles,
  onStyleChange,
}) => {
  const hasValue = ALL_PROPS.some((p) => {
    const v = computedStyles[p] || "0px";
    return v !== "0px" && v !== "0";
  });
  const [collapsed, setCollapsed] = useState(!hasValue);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setCollapsed(!hasValue); }, [hasValue]);

  // Auto-expand if sides differ
  const padT = px(computedStyles["padding-top"]);
  const padR = px(computedStyles["padding-right"]);
  const padB = px(computedStyles["padding-bottom"]);
  const padL = px(computedStyles["padding-left"]);
  const marT = px(computedStyles["margin-top"]);
  const marR = px(computedStyles["margin-right"]);
  const marB = px(computedStyles["margin-bottom"]);
  const marL = px(computedStyles["margin-left"]);

  const padHorizSame = padL === padR;
  const padVertSame = padT === padB;
  const marHorizSame = marL === marR;
  const marVertSame = marT === marB;
  const sidesMatch = padHorizSame && padVertSame && marHorizSame && marVertSame;

  useEffect(() => {
    if (!sidesMatch) setExpanded(true);
  }, [sidesMatch]);

  // Compact handlers: set both sides at once
  const handlePadHoriz = useCallback(
    (v: number) => { onStyleChange("padding-left", `${v}px`); onStyleChange("padding-right", `${v}px`); },
    [onStyleChange]
  );
  const handlePadVert = useCallback(
    (v: number) => { onStyleChange("padding-top", `${v}px`); onStyleChange("padding-bottom", `${v}px`); },
    [onStyleChange]
  );
  const handleMarHoriz = useCallback(
    (v: number) => { onStyleChange("margin-left", `${v}px`); onStyleChange("margin-right", `${v}px`); },
    [onStyleChange]
  );
  const handleMarVert = useCallback(
    (v: number) => { onStyleChange("margin-top", `${v}px`); onStyleChange("margin-bottom", `${v}px`); },
    [onStyleChange]
  );

  // Expanded handlers: individual sides
  const handle = useCallback(
    (prop: string) => (v: number) => onStyleChange(prop, `${v}px`),
    [onStyleChange]
  );

  return (
    <div className="pd-section">
      <div className="pd-section__header" onClick={() => setCollapsed((c) => !c)}>
        <span className="pd-section__title">Spacing</span>
        {collapsed && !hasValue ? (
          <button className="pd-section__plus-btn" onClick={(e) => { e.stopPropagation(); setCollapsed(false); }} type="button">+</button>
        ) : (
          <span className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}>&#9662;</span>
        )}
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          {!expanded ? (
            <>
              {/* Compact: horiz + vert per group */}
              <div className="pd-section__row pd-spacing__compact-row">
                <NumberInput label={"\u2194"} value={padL} onChange={handlePadHoriz} min={0} suffix="px" />
                <NumberInput label={"\u2195"} value={padT} onChange={handlePadVert} min={0} suffix="px" />
                <button
                  className="pd-spacing__expand-btn"
                  type="button"
                  title="Show all sides"
                  onClick={() => setExpanded(true)}
                >
                  &#x25A1;
                </button>
              </div>
              <div className="pd-section__row pd-spacing__compact-row">
                <NumberInput label={"\u2194"} value={marL} onChange={handleMarHoriz} suffix="px" />
                <NumberInput label={"\u2195"} value={marT} onChange={handleMarVert} suffix="px" />
                <div className="pd-spacing__expand-placeholder" />
              </div>
              <div className="pd-spacing__compact-labels">
                <span>Padding</span>
                <span>Margin</span>
              </div>
            </>
          ) : (
            <>
              {/* Expanded: all 4 sides */}
              <div className="pd-spacing__group">
                <div className="pd-spacing__group-header">
                  <span className="pd-section__label">Padding</span>
                  <button
                    className="pd-spacing__expand-btn"
                    type="button"
                    title="Compact view"
                    onClick={() => setExpanded(false)}
                  >
                    &#x25A0;
                  </button>
                </div>
                <div className="pd-section__row pd-section__row--half">
                  <NumberInput label="T" value={padT} onChange={handle("padding-top")} min={0} suffix="px" />
                  <NumberInput label="R" value={padR} onChange={handle("padding-right")} min={0} suffix="px" />
                </div>
                <div className="pd-section__row pd-section__row--half">
                  <NumberInput label="B" value={padB} onChange={handle("padding-bottom")} min={0} suffix="px" />
                  <NumberInput label="L" value={padL} onChange={handle("padding-left")} min={0} suffix="px" />
                </div>
              </div>
              <div className="pd-spacing__group">
                <span className="pd-section__label">Margin</span>
                <div className="pd-section__row pd-section__row--half">
                  <NumberInput label="T" value={marT} onChange={handle("margin-top")} suffix="px" />
                  <NumberInput label="R" value={marR} onChange={handle("margin-right")} suffix="px" />
                </div>
                <div className="pd-section__row pd-section__row--half">
                  <NumberInput label="B" value={marB} onChange={handle("margin-bottom")} suffix="px" />
                  <NumberInput label="L" value={marL} onChange={handle("margin-left")} suffix="px" />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
