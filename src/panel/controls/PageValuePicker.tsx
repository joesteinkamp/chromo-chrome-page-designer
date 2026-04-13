import React from "react";
import "./controls.css";

interface PageValuePickerProps {
  values: number[];
  onChange: (v: number) => void;
  label?: string;
  currentValue?: number;
  suffix?: string;
  className?: string;
}

/**
 * Compact chip row of numerical values detected on the page.
 * Numerical analogue of the Page Colors picker inside ColorPicker.
 * Returns null when there are no values, so sections stay clean.
 */
export const PageValuePicker: React.FC<PageValuePickerProps> = ({
  values,
  onChange,
  label = "Page values",
  currentValue,
  suffix = "px",
  className,
}) => {
  if (!values || values.length === 0) return null;
  return (
    <div className={`pd-page-values ${className || ""}`}>
      <div className="pd-page-values__label">{label}</div>
      <div className="pd-page-values__chips">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            className={`pd-page-values__chip${v === currentValue ? " pd-page-values__chip--active" : ""}`}
            title={`${v}${suffix}`}
            onClick={() => onChange(v)}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
};
