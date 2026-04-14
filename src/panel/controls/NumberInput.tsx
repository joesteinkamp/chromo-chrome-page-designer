import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
  const [localValue, setLocalValue] = useState(String(value));
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dragRef = useRef({ startX: 0, startValue: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isDragging && document.activeElement !== inputRef.current) {
      setLocalValue(String(value));
    }
  }, [value, isDragging]);

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
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed)) {
      const clamped = clamp(parsed);
      onChange(clamped);
      setLocalValue(String(clamped));
    } else {
      setLocalValue(String(value));
    }
  }, [localValue, clamp, onChange, value]);

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
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIndex((i) => (i < filtered.length - 1 ? i + 1 : 0));
          return;
        }
        if (e.key === "ArrowUp") {
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
        onChange(clamp(value + step));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onChange(clamp(value - step));
      }
    },
    [showDropdown, filtered, activeIndex, applySuggestion, value, step, clamp, onChange]
  );

  const handleLabelMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragRef.current = { startX: e.clientX, startValue: value };

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - dragRef.current.startX;
        const steps = Math.round(delta / 2);
        const newVal = clamp(dragRef.current.startValue + steps * step);
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
    [value, step, clamp, onChange]
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
