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

function normalizeValue(
  val: string,
  allowed: readonly string[]
): string {
  // Map shorthand values
  if (val === "start") return "flex-start";
  if (val === "end") return "flex-end";
  if (allowed.includes(val)) return val;
  return allowed[0];
}

export const AlignmentGrid: React.FC<AlignmentGridProps> = ({
  justifyContent,
  alignItems,
  onChange,
  className,
}) => {
  const normJustify = normalizeValue(justifyContent, JUSTIFY_VALUES);
  const normAlign = normalizeValue(alignItems, ALIGN_VALUES);

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
