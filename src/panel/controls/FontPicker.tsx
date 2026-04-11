import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ALL_FONTS } from "../../shared/google-fonts";
import { ChevronDown } from "../icons";
import "./controls.css";

interface FontPickerProps {
  value: string;
  onChange: (family: string) => void;
}

export const FontPicker: React.FC<FontPickerProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus input when opening
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query) return ALL_FONTS;
    const q = query.toLowerCase();
    return ALL_FONTS.filter((f) => f.label.toLowerCase().includes(q));
  }, [query]);

  const handleSelect = useCallback(
    (family: string) => {
      onChange(family);
      setOpen(false);
      setQuery("");
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      } else if (e.key === "Enter" && filtered.length > 0) {
        handleSelect(filtered[0].value);
      }
    },
    [filtered, handleSelect]
  );

  // Display label: strip quotes from value
  const displayLabel = value.replace(/^['"]|['"]$/g, "");

  return (
    <div className="pd-font-picker" ref={containerRef}>
      <button
        className="pd-font-picker__trigger"
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pd-font-picker__value">{displayLabel}</span>
        <span className="pd-font-picker__arrow"><ChevronDown size={12} /></span>
      </button>

      {open && (
        <div className="pd-font-picker__dropdown">
          <div className="pd-font-picker__search">
            <input
              ref={inputRef}
              className="pd-font-picker__input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search fonts..."
            />
          </div>
          <div className="pd-font-picker__list" ref={listRef}>
            {filtered.length === 0 && (
              <div className="pd-font-picker__empty">No fonts found</div>
            )}
            {/* System fonts group */}
            {filtered.some((f) => f.group === "system") && (
              <>
                <div className="pd-font-picker__group-label">System</div>
                {filtered
                  .filter((f) => f.group === "system")
                  .map((f) => (
                    <button
                      key={f.value}
                      className={`pd-font-picker__item${f.value === value ? " pd-font-picker__item--active" : ""}`}
                      type="button"
                      onClick={() => handleSelect(f.value)}
                    >
                      {f.label}
                    </button>
                  ))}
              </>
            )}
            {/* Google Fonts group */}
            {filtered.some((f) => f.group === "google") && (
              <>
                <div className="pd-font-picker__group-label">Google Fonts</div>
                {filtered
                  .filter((f) => f.group === "google")
                  .map((f) => (
                    <button
                      key={f.value}
                      className={`pd-font-picker__item${f.value === value ? " pd-font-picker__item--active" : ""}`}
                      type="button"
                      onClick={() => handleSelect(f.value)}
                    >
                      {f.label}
                    </button>
                  ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
