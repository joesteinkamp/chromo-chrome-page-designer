import React, { useState, useCallback, useMemo, useEffect } from "react";
import { NumberInput, ColorPicker } from "../controls";
import { ChevronDown, PlusIcon, MinusIcon } from "../icons";
import { isMixedValue } from "../controls/mixed";
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

/**
 * Split a box-shadow list on top-level commas — commas inside color
 * functions (rgba(), hsl()) don't separate shadows.
 */
function splitShadows(raw: string): string[] {
  if (!raw || raw === "none") return [];
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of raw) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseSingleShadow(raw: string): ShadowValues {
  const result: ShadowValues = {
    inset: false,
    x: 0,
    y: 0,
    blur: 0,
    spread: 0,
    color: "rgba(0, 0, 0, 0.25)",
  };

  // Check for inset
  let working = raw.trim();
  if (working.startsWith("inset")) {
    result.inset = true;
    working = working.slice(5).trim();
  }

  // Extract color — could be at the start or end. Computed values are
  // usually rgb()/rgba(), but wide-gamut colors survive as color()/lab()/
  // oklch() etc; extract any functional color with balanced parens so its
  // numbers never leak into the offset/blur parsing.
  let colorStr = "";
  const fnMatch = /(?:rgba?|hsla?|color-mix|color|lab|lch|oklab|oklch)\(/i.exec(working);
  if (fnMatch) {
    let depth = 0;
    let end = fnMatch.index;
    for (let i = fnMatch.index; i < working.length; i++) {
      if (working[i] === "(") depth++;
      else if (working[i] === ")") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    colorStr = working.slice(fnMatch.index, end);
    working = (working.slice(0, fnMatch.index) + working.slice(end)).trim();
  } else {
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
  // Multi-selection "Mixed" shadows can't be decomposed into shared controls —
  // treat as unset; setting a shadow applies it to the whole selection.
  const rawValue = computedStyles["box-shadow"] || "none";
  const rawShadow = isMixedValue(rawValue) ? "none" : rawValue;
  const hasValue = rawShadow !== "none";
  const [collapsed, setCollapsed] = useState(!hasValue);
  useEffect(() => { setCollapsed(!hasValue); }, [hasValue]);

  // Shadows are a list, Figma-style: stack as many drop/inset shadows as
  // the design needs; each row edits one layer of the box-shadow value.
  const shadows = useMemo(
    () => splitShadows(rawShadow).map(parseSingleShadow),
    [rawShadow]
  );

  // Compose edits from the last EMITTED list, not the last-received prop —
  // a blur-commit followed immediately by a click on another row's control
  // would otherwise rebuild the list from stale data and revert the commit.
  // The prop catches up after the content-script round trip, clearing this.
  const pendingRef = React.useRef<ShadowValues[] | null>(null);
  useEffect(() => {
    pendingRef.current = null;
  }, [rawShadow]);
  const currentShadows = useCallback(
    () => pendingRef.current ?? shadows,
    [shadows]
  );

  const emit = useCallback(
    (list: ShadowValues[]) => {
      pendingRef.current = list;
      onStyleChange(
        "box-shadow",
        list.length > 0 ? list.map(composeShadow).join(", ") : "none"
      );
    },
    [onStyleChange]
  );

  const updateAt = useCallback(
    (index: number, patch: Partial<ShadowValues>) => {
      emit(currentShadows().map((s, i) => (i === index ? { ...s, ...patch } : s)));
    },
    [currentShadows, emit]
  );

  const removeAt = useCallback(
    (index: number) => {
      emit(currentShadows().filter((_, i) => i !== index));
    },
    [currentShadows, emit]
  );

  const addShadow = useCallback(() => {
    emit([...currentShadows(), { ...DEFAULT_SHADOW }]);
    setCollapsed(false);
  }, [currentShadows, emit]);

  return (
    <div className={`pd-section${sectionDisabled ? " pd-section--disabled" : ""}`}>
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Shadow{sectionDisabled ? " (N/A)" : ""}</span>
        {collapsed && !hasValue ? (
          <button className="pd-section__plus-btn" onClick={(e) => { e.stopPropagation(); addShadow(); }} type="button" title="Add shadow"><PlusIcon size={12} /></button>
        ) : (
          <div className="pd-section__header-actions">
            <button className="pd-section__plus-btn" onClick={(e) => { e.stopPropagation(); addShadow(); }} type="button" title="Add shadow"><PlusIcon size={12} /></button>
            <span className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}><ChevronDown size={12} /></span>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          {shadows.length === 0 && (
            <button
              className="pd-section__add-btn"
              onClick={addShadow}
              type="button"
            >
              + Add shadow
            </button>
          )}
          {shadows.map((shadow, i) => (
            // Length in the key remounts rows on add/remove, so an open
            // color popover can't end up editing a shifted neighbor's layer.
            <div className="pd-shadow__item" key={`${shadows.length}-${i}`}>
              <div className="pd-section__row">
                <ColorPicker
                  value={shadow.color}
                  onChange={(v) => updateAt(i, { color: v })}
                />
                <button
                  className={`pd-section__toggle-btn${shadow.inset ? " pd-section__toggle-btn--active" : ""}`}
                  onClick={() => updateAt(i, { inset: !shadow.inset })}
                  type="button"
                  title={shadow.inset ? "Switch to drop shadow" : "Switch to inset shadow"}
                >
                  {shadow.inset ? "Inset" : "Drop"}
                </button>
                <button
                  className="pd-section__minus-btn"
                  onClick={() => removeAt(i)}
                  type="button"
                  title="Remove this shadow"
                >
                  <MinusIcon size={12} />
                </button>
              </div>
              <div className="pd-section__row pd-section__row--half">
                <NumberInput
                  value={shadow.x}
                  onChange={(v) => updateAt(i, { x: v })}
                  label="X"
                  suffix="px"
                />
                <NumberInput
                  value={shadow.y}
                  onChange={(v) => updateAt(i, { y: v })}
                  label="Y"
                  suffix="px"
                />
              </div>
              <div className="pd-section__row pd-section__row--half">
                <NumberInput
                  value={shadow.blur}
                  onChange={(v) => updateAt(i, { blur: v })}
                  label="Blur"
                  min={0}
                  suffix="px"
                />
                <NumberInput
                  value={shadow.spread}
                  onChange={(v) => updateAt(i, { spread: v })}
                  label="Spread"
                  suffix="px"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
