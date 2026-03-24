import React, { useCallback } from "react";
import "./controls.css";

interface DirectionToggleProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

const DIRECTIONS = [
  { value: "row", icon: "\u2192", title: "Row" },
  { value: "column", icon: "\u2193", title: "Column" },
  { value: "row-reverse", icon: "\u2190", title: "Row Reverse" },
  { value: "column-reverse", icon: "\u2191", title: "Column Reverse" },
] as const;

export const DirectionToggle: React.FC<DirectionToggleProps> = ({
  value,
  onChange,
  className,
}) => {
  const handleClick = useCallback(
    (dir: string) => {
      onChange(dir);
    },
    [onChange]
  );

  return (
    <div className={`pd-direction-toggle ${className || ""}`}>
      {DIRECTIONS.map((dir) => (
        <button
          key={dir.value}
          className={`pd-direction-toggle__btn${value === dir.value ? " pd-direction-toggle__btn--active" : ""}`}
          onClick={() => handleClick(dir.value)}
          type="button"
          title={dir.title}
        >
          {dir.icon}
        </button>
      ))}
    </div>
  );
};
