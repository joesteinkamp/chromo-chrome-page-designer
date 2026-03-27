import React, { useState, useEffect, useCallback } from "react";
import "./options.css";

interface Settings {
  defaultUnit: "px" | "rem" | "em";
}

const DEFAULT_SETTINGS: Settings = {
  defaultUnit: "px",
};

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [version, setVersion] = useState("");

  useEffect(() => {
    const manifest = chrome.runtime.getManifest();
    setVersion(manifest.version);

    chrome.storage.sync.get(["defaultUnit"], (result) => {
      setSettings({
        defaultUnit: result.defaultUnit || DEFAULT_SETTINGS.defaultUnit,
      });
    });
  }, []);

  const handleUnitChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSettings((prev) => ({
        ...prev,
        defaultUnit: e.target.value as "px" | "rem" | "em",
      }));
    },
    []
  );

  const handleSave = useCallback(() => {
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        setMessage({
          type: "error",
          text: `Failed to save: ${chrome.runtime.lastError.message}`,
        });
      } else {
        setMessage({ type: "success", text: "Settings saved successfully." });
      }
      setTimeout(() => setMessage(null), 3000);
    });
  }, [settings]);

  return (
    <div className="pd-options">
      <div className="pd-options__header">
        <div className="pd-options__title">Design in Chrome Settings</div>
        {version && (
          <div className="pd-options__version">v{version}</div>
        )}
      </div>

      {/* Preferences */}
      <div className="pd-options__section">
        <div className="pd-options__section-title">Preferences</div>

        <div className="pd-options__field">
          <label className="pd-options__label">Default Unit</label>
          <select
            className="pd-options__select"
            value={settings.defaultUnit}
            onChange={handleUnitChange}
          >
            <option value="px">px</option>
            <option value="rem">rem</option>
            <option value="em">em</option>
          </select>
        </div>

        <button
          type="button"
          className="pd-options__save"
          onClick={handleSave}
        >
          Save
        </button>

        {message && (
          <div
            className={`pd-options__message pd-options__message--${message.type}`}
          >
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
