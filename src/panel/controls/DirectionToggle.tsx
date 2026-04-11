import React, { useCallback, type ReactNode } from "react";
import { ArrowRight, ArrowDown, ArrowLeft, ArrowUp } from "../icons";
import "./controls.css";

interface DirectionToggleProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

const DIRECTIONS: readonly { value: string; icon: ReactNode; title: string }[] = [
  { value: "row", icon: <ArrowRight size={14} />, title: "Row" },
  { value: "column", icon: <ArrowDown size={14} />, title: "Column" },
  { value: "row-reverse", icon: <ArrowLeft size={14} />, title: "Row Reverse" },
  { value: "column-reverse", icon: <ArrowUp size={14} />, title: "Column Reverse" },
];

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
