import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "../icons";
import "./controls.css";

const DEFAULT_UNITS = ["px", "rem", "em", "%", "vw", "vh", "auto"];

interface UnitInputProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  units?: string[];
  className?: string;
}

function parseCSSValue(value: string): { num: number; unit: string } {
  if (value === "auto") return { num: 0, unit: "auto" };
  const match = value.match(/^(-?[\d.]+)\s*([a-z%]*)$/i);
  if (match) {
    return {
      num: parseFloat(match[1]),
      unit: match[2] || "px",
    };
  }
  return { num: 0, unit: "auto" };
}

/** Format a numeric value for display — trims trailing zeros from decimals. */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

export const UnitInput: React.FC<UnitInputProps> = ({
  value,
  onChange,
  label,
  units = DEFAULT_UNITS,
  className,
}) => {
  const parsed = useMemo(() => parseCSSValue(value), [value]);
  const isAuto = parsed.unit === "auto";

  const [localValue, setLocalValue] = useState(isAuto ? "Auto" : formatNumber(parsed.num));
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startX: 0, startValue: 0 });

  // Sync local text with incoming prop when not being edited
  useEffect(() => {
    if (!isFocused && !isDragging) {
      setLocalValue(isAuto ? "Auto" : formatNumber(parsed.num));
    }
  }, [parsed.num, isAuto, isFocused, isDragging]);

  // Close popover on outside click / Escape
  useEffect(() => {
    if (!popoverOpen) return;
    const handleDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setPopoverOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopoverOpen(false);
    };
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [popoverOpen]);

  const commitValue = useCallback(() => {
    const trimmed = localValue.trim();
    if (!trimmed || /^auto$/i.test(trimmed)) {
      onChange("auto");
      setLocalValue("Auto");
      return;
    }
    const num = parseFloat(trimmed);
    if (isNaN(num)) {
      // revert
      setLocalValue(isAuto ? "Auto" : formatNumber(parsed.num));
      return;
    }
    // Typing a number when currently auto transitions to px; otherwise keep the current unit.
    const nextUnit = isAuto ? "px" : parsed.unit;
    onChange(`${num}${nextUnit}`);
    setLocalValue(formatNumber(num));
  }, [localValue, isAuto, parsed.num, parsed.unit, onChange]);

  const handleInputFocus = useCallback(() => {
    setIsFocused(true);
    // Clear "Auto" text so user can type a number immediately
    if (isAuto) setLocalValue("");
  }, [isAuto]);

  const handleInputBlur = useCallback(() => {
    commitValue();
    setIsFocused(false);
  }, [commitValue]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        setLocalValue(isAuto ? "Auto" : formatNumber(parsed.num));
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (isAuto) return;
        e.preventDefault();
        const step = parsed.unit === "rem" || parsed.unit === "em" ? 0.125 : 1;
        const delta = e.key === "ArrowUp" ? step : -step;
        const next = parsed.num + delta;
        onChange(`${next}${parsed.unit}`);
      }
    },
    [isAuto, parsed.num, parsed.unit, onChange]
  );

  const handleLabelMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isAuto) return;
      e.preventDefault();
      setIsDragging(true);
      const step = parsed.unit === "rem" || parsed.unit === "em" ? 0.125 : 1;
      dragRef.current = { startX: e.clientX, startValue: parsed.num };

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - dragRef.current.startX;
        const steps = Math.round(delta / 2);
        const newVal = dragRef.current.startValue + steps * step;
        onChange(`${newVal}${parsed.unit}`);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [isAuto, parsed.num, parsed.unit, onChange]
  );

  const handleUnitSelect = useCallback(
    (newUnit: string) => {
      setPopoverOpen(false);
      if (newUnit === parsed.unit) return;
      if (newUnit === "auto") {
        onChange("auto");
      } else {
        const num = isAuto ? 0 : parsed.num;
        onChange(`${num}${newUnit}`);
      }
    },
    [parsed.num, parsed.unit, isAuto, onChange]
  );

  return (
    <div ref={rootRef} className={`pd-unit-input ${className || ""}`}>
      {label && (
        <label
          className="pd-unit-input__label"
          onMouseDown={handleLabelMouseDown}
        >
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        className={`pd-unit-input__input${isAuto && !isFocused ? " pd-unit-input__input--auto" : ""}`}
        type="text"
        value={localValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
      />
      <button
        type="button"
        className="pd-unit-input__unit-trigger"
        onClick={() => setPopoverOpen((o) => !o)}
        aria-label="Change unit"
        aria-haspopup="listbox"
        aria-expanded={popoverOpen}
      >
        {!isAuto && <span className="pd-unit-input__unit-text">{parsed.unit}</span>}
        <span className="pd-unit-input__unit-chevron">
          <ChevronDown size={10} />
        </span>
      </button>
      {popoverOpen && (
        <ul
          className="pd-unit-input__unit-popover"
          role="listbox"
          aria-label="Unit"
        >
          {units.map((u) => (
            <li
              key={u}
              role="option"
              aria-selected={u === parsed.unit}
              className={`pd-unit-input__unit-option${u === parsed.unit ? " pd-unit-input__unit-option--active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleUnitSelect(u);
              }}
            >
              {u}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
