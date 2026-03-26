import React, { useState, useCallback, useEffect, useRef } from "react";
import { NumberInput } from "../controls";
import "./sections.css";

interface SpacingSectionProps {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

type SpacingMode = "single" | "hv" | "sides";

const ALL_PROPS = [
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
];

function px(val: string | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function detectMode(t: number, r: number, b: number, l: number): SpacingMode {
  if (t === b && l === r && t === l) return "single";
  if (t === b && l === r) return "hv";
  return "sides";
}

interface SpacingGroupProps {
  label: string;
  top: number;
  right: number;
  bottom: number;
  left: number;
  min?: number;
  onChangeAll: (v: number) => void;
  onChangeHoriz: (v: number) => void;
  onChangeVert: (v: number) => void;
  onChangeSide: (side: string, v: number) => void;
  sidePrefix: string;
}

function SpacingGroup({
  label, top, right, bottom, left, min,
  onChangeAll, onChangeHoriz, onChangeVert, onChangeSide, sidePrefix,
}: SpacingGroupProps) {
  const [mode, setMode] = useState<SpacingMode>(() => detectMode(top, right, bottom, left));
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);

  // Auto-upgrade mode if values diverge
  useEffect(() => {
    const needed = detectMode(top, right, bottom, left);
    if (needed === "sides" && mode !== "sides") setMode("sides");
    else if (needed === "hv" && mode === "single") setMode("hv");
  }, [top, right, bottom, left]);

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        gearRef.current && !gearRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popoverOpen]);

  const selectMode = (m: SpacingMode) => {
    setMode(m);
    setPopoverOpen(false);
  };

  return (
    <div className="pd-spacing__group">
      <div className="pd-spacing__group-header">
        <span className="pd-spacing__group-label">{label}</span>
        <button
          ref={gearRef}
          className={`pd-section__icon-btn${popoverOpen ? " pd-section__icon-btn--active" : ""}`}
          type="button"
          title={`${label} options`}
          onClick={() => setPopoverOpen((o) => !o)}
        >
          &#x2699;
        </button>
      </div>

      {mode === "single" && (
        <div className="pd-section__row">
          <NumberInput value={top} onChange={onChangeAll} min={min} suffix="px" />
        </div>
      )}

      {mode === "hv" && (
        <div className="pd-section__row pd-section__row--half">
          <NumberInput label={"\u2194"} value={left} onChange={onChangeHoriz} min={min} suffix="px" />
          <NumberInput label={"\u2195"} value={top} onChange={onChangeVert} min={min} suffix="px" />
        </div>
      )}

      {mode === "sides" && (
        <>
          <div className="pd-section__row pd-section__row--half">
            <NumberInput label="T" value={top} onChange={(v) => onChangeSide(`${sidePrefix}-top`, v)} min={min} suffix="px" />
            <NumberInput label="R" value={right} onChange={(v) => onChangeSide(`${sidePrefix}-right`, v)} min={min} suffix="px" />
          </div>
          <div className="pd-section__row pd-section__row--half">
            <NumberInput label="B" value={bottom} onChange={(v) => onChangeSide(`${sidePrefix}-bottom`, v)} min={min} suffix="px" />
            <NumberInput label="L" value={left} onChange={(v) => onChangeSide(`${sidePrefix}-left`, v)} min={min} suffix="px" />
          </div>
        </>
      )}

      {popoverOpen && (
        <div className="pd-spacing__popover" ref={popoverRef}>
          <div className="pd-spacing__popover-title">{label} Values</div>
          <label className="pd-spacing__popover-option" onClick={() => selectMode("single")}>
            <span className={`pd-spacing__radio${mode === "single" ? " pd-spacing__radio--active" : ""}`} />
            One value for all sides
          </label>
          <label className="pd-spacing__popover-option" onClick={() => selectMode("hv")}>
            <span className={`pd-spacing__radio${mode === "hv" ? " pd-spacing__radio--active" : ""}`} />
            Horizontal/Vertical
          </label>
          <label className="pd-spacing__popover-option" onClick={() => selectMode("sides")}>
            <span className={`pd-spacing__radio${mode === "sides" ? " pd-spacing__radio--active" : ""}`} />
            Top/Right/Bottom/Left
          </label>
        </div>
      )}
    </div>
  );
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
  useEffect(() => { setCollapsed(!hasValue); }, [hasValue]);

  const padT = px(computedStyles["padding-top"]);
  const padR = px(computedStyles["padding-right"]);
  const padB = px(computedStyles["padding-bottom"]);
  const padL = px(computedStyles["padding-left"]);
  const marT = px(computedStyles["margin-top"]);
  const marR = px(computedStyles["margin-right"]);
  const marB = px(computedStyles["margin-bottom"]);
  const marL = px(computedStyles["margin-left"]);

  const handlePadAll = useCallback(
    (v: number) => { onStyleChange("padding", `${v}px`); },
    [onStyleChange]
  );
  const handlePadHoriz = useCallback(
    (v: number) => { const s = `${v}px`; onStyleChange("padding-left", s); onStyleChange("padding-right", s); },
    [onStyleChange]
  );
  const handlePadVert = useCallback(
    (v: number) => { const s = `${v}px`; onStyleChange("padding-top", s); onStyleChange("padding-bottom", s); },
    [onStyleChange]
  );
  const handleMarAll = useCallback(
    (v: number) => { onStyleChange("margin", `${v}px`); },
    [onStyleChange]
  );
  const handleMarHoriz = useCallback(
    (v: number) => { const s = `${v}px`; onStyleChange("margin-left", s); onStyleChange("margin-right", s); },
    [onStyleChange]
  );
  const handleMarVert = useCallback(
    (v: number) => { const s = `${v}px`; onStyleChange("margin-top", s); onStyleChange("margin-bottom", s); },
    [onStyleChange]
  );
  const handleSide = useCallback(
    (prop: string, v: number) => onStyleChange(prop, `${v}px`),
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
          <SpacingGroup
            label="Padding"
            top={padT} right={padR} bottom={padB} left={padL}
            min={0}
            onChangeAll={handlePadAll}
            onChangeHoriz={handlePadHoriz}
            onChangeVert={handlePadVert}
            onChangeSide={handleSide}
            sidePrefix="padding"
          />
          <SpacingGroup
            label="Margin"
            top={marT} right={marR} bottom={marB} left={marL}
            onChangeAll={handleMarAll}
            onChangeHoriz={handleMarHoriz}
            onChangeVert={handleMarVert}
            onChangeSide={handleSide}
            sidePrefix="margin"
          />
        </div>
      )}
    </div>
  );
};
