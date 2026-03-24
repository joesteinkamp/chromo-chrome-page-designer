import React, { useState, useRef, useCallback, useEffect } from "react";
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
}) => {
  const [localValue, setLocalValue] = useState(String(value));
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startValue: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isDragging && document.activeElement !== inputRef.current) {
      setLocalValue(String(value));
    }
  }, [value, isDragging]);

  const clamp = useCallback(
    (v: number) => {
      let result = v;
      if (min !== undefined) result = Math.max(min, result);
      if (max !== undefined) result = Math.min(max, result);
      return result;
    },
    [min, max]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalValue(e.target.value);
    },
    []
  );

  const handleInputBlur = useCallback(() => {
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed)) {
      const clamped = clamp(parsed);
      onChange(clamped);
      setLocalValue(String(clamped));
    } else {
      setLocalValue(String(value));
    }
  }, [localValue, clamp, onChange, value]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const newVal = clamp(value + step);
        onChange(newVal);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const newVal = clamp(value - step);
        onChange(newVal);
      }
    },
    [value, step, clamp, onChange]
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
      <div className="pd-number-input__field-wrap">
        <input
          ref={inputRef}
          className="pd-number-input__input"
          type="text"
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
        />
        {suffix && <span className="pd-number-input__suffix">{suffix}</span>}
      </div>
    </div>
  );
};
