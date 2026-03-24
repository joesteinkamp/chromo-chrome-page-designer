import React, { useCallback, useRef } from "react";
import { NumberInput } from "./NumberInput";
import "./controls.css";

interface SliderInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  suffix?: string;
  className?: string;
}

export const SliderInput: React.FC<SliderInputProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  suffix,
  className,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const clamp = useCallback(
    (v: number) => Math.min(max, Math.max(min, v)),
    [min, max]
  );

  const valueFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      // Snap to step
      const stepped = Math.round(raw / step) * step;
      return clamp(stepped);
    },
    [min, max, step, value, clamp]
  );

  const handleTrackMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onChange(valueFromClientX(e.clientX));

      const handleMove = (ev: MouseEvent) => {
        onChange(valueFromClientX(ev.clientX));
      };
      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [onChange, valueFromClientX]
  );

  const fillPercent = ((clamp(value) - min) / (max - min)) * 100;

  return (
    <div className={`pd-slider-input ${className || ""}`}>
      {label && <span className="pd-slider-input__label">{label}</span>}
      <div className="pd-slider-input__row">
        <div
          ref={trackRef}
          className="pd-slider-input__track-wrap"
          onMouseDown={handleTrackMouseDown}
        >
          <div className="pd-slider-input__track">
            <div
              className="pd-slider-input__track-fill"
              style={{ width: `${fillPercent}%` }}
            />
          </div>
          <div
            className="pd-slider-input__thumb"
            style={{ left: `${fillPercent}%` }}
          />
        </div>
        <div className="pd-slider-input__value">
          <NumberInput
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            step={step}
            suffix={suffix}
          />
        </div>
      </div>
    </div>
  );
};
