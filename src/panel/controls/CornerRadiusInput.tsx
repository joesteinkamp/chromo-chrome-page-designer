import React, { useState, useCallback, useMemo } from "react";
import { NumberInput } from "./NumberInput";
import { PageValuePicker } from "./PageValuePicker";
import { LinkIcon, UnlinkIcon } from "../icons";
import "./controls.css";

interface CornerRadiusInputProps {
  values: [string, string, string, string]; // TL, TR, BR, BL
  onChange: (values: [string, string, string, string]) => void;
  className?: string;
  pageValues?: number[];
}

const CORNER_LABELS = ["TL", "TR", "BR", "BL"] as const;

function parseRadius(v: string): number {
  const num = parseFloat(v);
  return isNaN(num) ? 0 : num;
}

export const CornerRadiusInput: React.FC<CornerRadiusInputProps> = ({
  values,
  onChange,
  className,
  pageValues,
}) => {
  const [linked, setLinked] = useState(true);

  const allSame = useMemo(
    () => values[0] === values[1] && values[1] === values[2] && values[2] === values[3],
    [values]
  );

  const handleLinkedChange = useCallback(
    (v: number) => {
      const str = `${v}px`;
      onChange([str, str, str, str]);
    },
    [onChange]
  );

  const handleCornerChange = useCallback(
    (index: number, v: number) => {
      const next: [string, string, string, string] = [...values];
      next[index] = `${v}px`;
      onChange(next);
    },
    [values, onChange]
  );

  const toggleLinked = useCallback(() => {
    setLinked((prev) => !prev);
  }, []);

  return (
    <div className={`pd-corner-radius ${className || ""}`}>
      <div className="pd-corner-radius__linked-row">
        <button
          className={`pd-corner-radius__link-btn${linked ? " pd-corner-radius__link-btn--active" : ""}`}
          onClick={toggleLinked}
          type="button"
          title={linked ? "Unlink corners" : "Link corners"}
        >
          {linked ? <LinkIcon size={14} /> : <UnlinkIcon size={14} />}
        </button>
        {linked && (
          <NumberInput
            value={parseRadius(values[0])}
            onChange={handleLinkedChange}
            min={0}
            suffix="px"
            label="All"
          />
        )}
      </div>

      {!linked && (
        <div className="pd-corner-radius__unlinked">
          {CORNER_LABELS.map((corner, i) => (
            <NumberInput
              key={corner}
              value={parseRadius(values[i])}
              onChange={(v) => handleCornerChange(i, v)}
              min={0}
              suffix="px"
              label={corner}
            />
          ))}
        </div>
      )}

      <PageValuePicker
        values={pageValues ?? []}
        onChange={handleLinkedChange}
        currentValue={linked && allSame ? parseRadius(values[0]) : undefined}
      />
    </div>
  );
};
