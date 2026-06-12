import React, { useState, useEffect, useCallback } from "react";
import { SelectDropdown } from "../controls";
import { ChevronDown } from "../icons";
import "./sections.css";

/** Visual properties carried by copy/paste style and saved presets */
const PRESET_PROPERTIES = [
  "background-color",
  "color",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-top-left-radius", "border-top-right-radius",
  "border-bottom-right-radius", "border-bottom-left-radius",
  "box-shadow", "opacity", "filter",
  "font-family", "font-size", "font-weight",
  "line-height", "letter-spacing", "text-transform",
] as const;

interface StylePreset {
  name: string;
  styles: Record<string, string>;
}

interface StylePresetsSectionProps {
  computedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

/**
 * Figma-style saved styles: copy the selected element's visual style, paste
 * it onto another element, or save it as a named preset reusable across
 * pages. Applying goes through the normal style-change flow so every
 * property lands in the change tracker.
 */
export const StylePresetsSection: React.FC<StylePresetsSectionProps> = ({
  computedStyles,
  onStyleChange,
}) => {
  const [collapsed, setCollapsed] = useState(true);
  const [hasCopiedStyle, setHasCopiedStyle] = useState(false);
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [savingName, setSavingName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(["copiedStyle", "stylePresets"], (result) => {
      setHasCopiedStyle(Boolean(result.copiedStyle));
      const stored: StylePreset[] = result.stylePresets || [];
      setPresets(stored);
      if (stored.length > 0) setSelectedPreset(stored[0].name);
    });
  }, []);

  const snapshotStyles = useCallback((): Record<string, string> => {
    const styles: Record<string, string> = {};
    for (const prop of PRESET_PROPERTIES) {
      const value = computedStyles[prop];
      if (value) styles[prop] = value;
    }
    return styles;
  }, [computedStyles]);

  const applyStyles = useCallback(
    (styles: Record<string, string>) => {
      for (const [prop, value] of Object.entries(styles)) {
        if (computedStyles[prop] !== value) {
          onStyleChange(prop, value);
        }
      }
    },
    [computedStyles, onStyleChange]
  );

  const handleCopy = useCallback(() => {
    chrome.storage.local.set({ copiedStyle: snapshotStyles() }, () => {
      setHasCopiedStyle(true);
    });
  }, [snapshotStyles]);

  const handlePaste = useCallback(() => {
    chrome.storage.local.get("copiedStyle", (result) => {
      if (result.copiedStyle) applyStyles(result.copiedStyle);
    });
  }, [applyStyles]);

  const handleSavePreset = useCallback(() => {
    const name = savingName.trim();
    if (!name) return;
    const next = [
      ...presets.filter((p) => p.name !== name),
      { name, styles: snapshotStyles() },
    ];
    chrome.storage.local.set({ stylePresets: next }, () => {
      setPresets(next);
      setSelectedPreset(name);
      setSavingName("");
      setShowSaveInput(false);
    });
  }, [savingName, presets, snapshotStyles]);

  const handleApplyPreset = useCallback(() => {
    const preset = presets.find((p) => p.name === selectedPreset);
    if (preset) applyStyles(preset.styles);
  }, [presets, selectedPreset, applyStyles]);

  const handleDeletePreset = useCallback(() => {
    const next = presets.filter((p) => p.name !== selectedPreset);
    chrome.storage.local.set({ stylePresets: next }, () => {
      setPresets(next);
      setSelectedPreset(next[0]?.name || "");
    });
  }, [presets, selectedPreset]);

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Styles</span>
        <span className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}>
          <ChevronDown size={12} />
        </span>
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          <div className="pd-section__row">
            <button className="pd-section__action-btn" onClick={handleCopy} type="button" title="Copy this element's fill, stroke, radius, shadow and typography">
              Copy style
            </button>
            <button
              className="pd-section__action-btn"
              onClick={handlePaste}
              disabled={!hasCopiedStyle}
              type="button"
              title="Apply the copied style to this element"
            >
              Paste style
            </button>
            <button
              className="pd-section__action-btn"
              onClick={() => setShowSaveInput((v) => !v)}
              type="button"
              title="Save this element's style as a named preset"
            >
              Save…
            </button>
          </div>
          {showSaveInput && (
            <div className="pd-section__row">
              <input
                type="text"
                className="pd-section__text-input"
                placeholder="Preset name"
                value={savingName}
                onChange={(e) => setSavingName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSavePreset(); }}
                autoFocus
              />
              <button
                className="pd-section__action-btn"
                onClick={handleSavePreset}
                disabled={!savingName.trim()}
                type="button"
              >
                Save
              </button>
            </div>
          )}
          {presets.length > 0 && (
            <div className="pd-section__row">
              <SelectDropdown
                value={selectedPreset}
                options={presets.map((p) => ({ value: p.name, label: p.name }))}
                onChange={setSelectedPreset}
              />
              <button className="pd-section__action-btn" onClick={handleApplyPreset} type="button">
                Apply
              </button>
              <button className="pd-section__action-btn pd-section__action-btn--danger" onClick={handleDeletePreset} type="button">
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
