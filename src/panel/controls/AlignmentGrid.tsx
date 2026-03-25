import React, { useCallback } from "react";
import "./controls.css";

interface AlignmentGridProps {
  justifyContent: string;
  alignItems: string;
  onChange: (justify: string, align: string) => void;
  className?: string;
}

const JUSTIFY_VALUES = ["flex-start", "center", "flex-end"] as const;
const ALIGN_VALUES = ["flex-start", "center", "flex-end"] as const;

function normalizeJustify(val: string): string {
  if (val === "center") return "center";
  if (val === "flex-end" || val === "end" || val === "right") return "flex-end";
  // normal, flex-start, start, left, space-between, space-around, space-evenly
  return "flex-start";
}

function normalizeAlign(val: string): string {
  if (val === "center") return "center";
  if (val === "flex-end" || val === "end") return "flex-end";
  // normal (stretch), flex-start, start, baseline, stretch
  return "flex-start";
}

export const AlignmentGrid: React.FC<AlignmentGridProps> = ({
  justifyContent,
  alignItems,
  onChange,
  className,
}) => {
  const normJustify = normalizeJustify(justifyContent);
  const normAlign = normalizeAlign(alignItems);

  const handleClick = useCallback(
    (justify: string, align: string) => {
      onChange(justify, align);
    },
    [onChange]
  );

  return (
    <div className={`pd-alignment-grid ${className || ""}`}>
      <div className="pd-alignment-grid__grid">
        {ALIGN_VALUES.map((align) =>
          JUSTIFY_VALUES.map((justify) => {
            const isActive =
              justify === normJustify && align === normAlign;
            return (
              <button
                key={`${justify}-${align}`}
                className={`pd-alignment-grid__cell${isActive ? " pd-alignment-grid__cell--active" : ""}`}
                onClick={() => handleClick(justify, align)}
                type="button"
                title={`justify: ${justify}, align: ${align}`}
              >
                <span className="pd-alignment-grid__dot" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
