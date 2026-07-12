import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { evaluateExpression } from "./expr";
import "./controls.css";

interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
  /** Suggested values (e.g. detected from page); shown as an autocomplete dropdown on focus. */
  suggestions?: number[];
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  label,
  min,
  max,
  step = 1,
  suffix,
  className,
  suggestions,
}) => {
  // NaN means the multi-selection disagrees on this property — render the
  // Figma-style "Mixed" placeholder; committing a number applies to all.
  const isMixed = Number.isNaN(value);
  const [localValue, setLocalValue] = useState(isMixed ? "" : String(value));
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dragRef = useRef({ startX: 0, startValue: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isDragging && document.activeElement !== inputRef.current) {
      setLocalValue(isMixed ? "" : String(value));
    }
  }, [value, isDragging, isMixed]);

  // Reset active highlight whenever the typed value or focus changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [localValue, isFocused]);

  useEffect(() => () => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
  }, []);

  const clamp = useCallback(
    (v: number) => {
      let result = v;
      if (min !== undefined) result = Math.max(min, result);
      if (max !== undefined) result = Math.min(max, result);
      return result;
    },
    [min, max]
  );

  const filtered = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];
    const trimmed = localValue.trim();
    if (!trimmed) return suggestions;
    // Only filter if the current text is a plausible numeric prefix; otherwise show all
    if (!/^\d*\.?\d*$/.test(trimmed)) return suggestions;
    const matches = suggestions.filter((s) => String(s).startsWith(trimmed));
    return matches.length > 0 ? matches : suggestions;
  }, [suggestions, localValue]);

  const showDropdown = isFocused && filtered.length > 0;

  const commitValue = useCallback(() => {
    // Figma-style math ("100+24", "300/2"). If the input contains operators
    // but doesn't evaluate, revert — parseFloat would silently commit just
    // the leading number ("1/0" → 1), which reads as the math half-working.
    const evaluated = evaluateExpression(localValue);
    const looksLikeMath = /[+*/]|.-/.test(localValue.trim());
    const parsed =
      evaluated !== null ? evaluated : looksLikeMath ? NaN : parseFloat(localValue);
    if (!isNaN(parsed)) {
      const clamped = clamp(parsed);
      onChange(clamped);
      setLocalValue(String(clamped));
    } else {
      setLocalValue(isMixed ? "" : String(value));
    }
  }, [localValue, clamp, onChange, value, isMixed]);

  const applySuggestion = useCallback(
    (v: number) => {
      const clamped = clamp(v);
      onChange(clamped);
      setLocalValue(String(clamped));
      setIsFocused(false);
      inputRef.current?.blur();
    },
    [clamp, onChange]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalValue(e.target.value);
    },
    []
  );

  const handleInputFocus = useCallback(() => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setIsFocused(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    commitValue();
    // Delay close so a suggestion click's onMouseDown + preventDefault has fully resolved
    blurTimerRef.current = window.setTimeout(() => {
      setIsFocused(false);
      blurTimerRef.current = null;
    }, 120);
  }, [commitValue]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showDropdown) {
        // Plain arrows navigate the suggestions; Shift+arrows fall through to
        // value stepping so the ×10 nudge stays reachable on these fields.
        if (e.key === "ArrowDown" && !e.shiftKey) {
          e.preventDefault();
          setActiveIndex((i) => (i < filtered.length - 1 ? i + 1 : 0));
          return;
        }
        if (e.key === "ArrowUp" && !e.shiftKey) {
          e.preventDefault();
          setActiveIndex((i) => (i > 0 ? i - 1 : filtered.length - 1));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < filtered.length) {
            applySuggestion(filtered[activeIndex]);
          } else {
            (e.target as HTMLInputElement).blur();
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setIsFocused(false);
          return;
        }
      }
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!isMixed) onChange(clamp(value + step * (e.shiftKey ? 10 : 1)));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!isMixed) onChange(clamp(value - step * (e.shiftKey ? 10 : 1)));
      }
    },
    [showDropdown, filtered, activeIndex, applySuggestion, value, step, clamp, onChange]
  );

  const handleLabelMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isMixed) return;
      e.preventDefault();
      setIsDragging(true);
      dragRef.current = { startX: e.clientX, startValue: value };

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - dragRef.current.startX;
        const steps = Math.round(delta / 2);
        const scrubStep = ev.shiftKey ? step * 10 : step;
        const newVal = clamp(dragRef.current.startValue + steps * scrubStep);
        onChange(newVal);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [value, step, clamp, onChange, isMixed]
  );

  return (
    <div className={`pd-number-input ${className || ""}`}>
      {label && (
        <label
          className="pd-number-input__label"
          onMouseDown={handleLabelMouseDown}
        >
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        className="pd-number-input__input"
        type="text"
        value={localValue}
        placeholder={isMixed ? "Mixed" : undefined}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
      />
      {suffix && <span className="pd-number-input__suffix">{suffix}</span>}
      {showDropdown && (
        <ul className="pd-number-input__dropdown" role="listbox" aria-label="Page values">
          <li className="pd-number-input__dropdown-header" aria-hidden="true">Page values</li>
          {filtered.map((v, i) => (
            <li
              key={v}
              role="option"
              aria-selected={i === activeIndex}
              className={`pd-number-input__dropdown-item${i === activeIndex ? " pd-number-input__dropdown-item--active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault(); // keep input from blurring before click applies
                applySuggestion(v);
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="pd-number-input__dropdown-value">{v}</span>
              {suffix && <span className="pd-number-input__dropdown-suffix">{suffix}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
