import React, { useCallback } from "react";
import { MIXED_VALUE } from "../../shared/constants";
import "./controls.css";

interface SelectDropdownProps {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  label?: string;
  className?: string;
}

export const SelectDropdown: React.FC<SelectDropdownProps> = ({
  value,
  options,
  onChange,
  label,
  className,
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  return (
    <div className={`pd-select ${className || ""}`}>
      {label && <label className="pd-select__label">{label}</label>}
      <select
        className="pd-select__control"
        value={value}
        onChange={handleChange}
      >
        {value === MIXED_VALUE && (
          <option value={MIXED_VALUE} disabled>
            Mixed
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
