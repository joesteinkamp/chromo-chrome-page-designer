import React, { useCallback, useMemo } from "react";
import { NumberInput } from "./NumberInput";
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
  return { num: 0, unit: "px" };
}

export const UnitInput: React.FC<UnitInputProps> = ({
  value,
  onChange,
  label,
  units = DEFAULT_UNITS,
  className,
}) => {
  const parsed = useMemo(() => parseCSSValue(value), [value]);

  const handleNumberChange = useCallback(
    (num: number) => {
      if (parsed.unit === "auto") {
        onChange("auto");
      } else {
        onChange(`${num}${parsed.unit}`);
      }
    },
    [parsed.unit, onChange]
  );

  const handleUnitChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newUnit = e.target.value;
      if (newUnit === "auto") {
        onChange("auto");
      } else {
        onChange(`${parsed.num}${newUnit}`);
      }
    },
    [parsed.num, onChange]
  );

  const isAuto = parsed.unit === "auto";

  return (
    <div className={`pd-unit-input ${className || ""}`}>
      <div className="pd-unit-input__number">
        <NumberInput
          value={isAuto ? 0 : parsed.num}
          onChange={handleNumberChange}
          step={parsed.unit === "rem" || parsed.unit === "em" ? 0.125 : 1}
          label={label}
        />
      </div>
      <select
        className="pd-unit-input__unit-select"
        value={parsed.unit}
        onChange={handleUnitChange}
      >
        {units.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  );
};
