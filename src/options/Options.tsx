import React, { useState, useEffect, useCallback } from "react";
import "./options.css";

interface Settings {
  defaultUnit: "px" | "rem" | "em";
  anthropicApiKey: string;
}

const DEFAULT_SETTINGS: Settings = {
  defaultUnit: "px",
  anthropicApiKey: "",
};

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [version, setVersion] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    const manifest = chrome.runtime.getManifest();
    setVersion(manifest.version);

    chrome.storage.sync.get(["defaultUnit", "anthropicApiKey"], (result) => {
      setSettings({
        defaultUnit: result.defaultUnit || DEFAULT_SETTINGS.defaultUnit,
        anthropicApiKey: result.anthropicApiKey || DEFAULT_SETTINGS.anthropicApiKey,
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
        <div className="pd-options__title">Chromo Design Settings</div>
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

      {/* AI Integration */}
      <div className="pd-options__section">
        <div className="pd-options__section-title">AI Integration</div>

        <div className="pd-options__field">
          <label className="pd-options__label">Anthropic API Key</label>
          <div className="pd-options__password-wrap">
            <input
              className="pd-options__input"
              type={showApiKey ? "text" : "password"}
              value={settings.anthropicApiKey}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, anthropicApiKey: e.target.value }))
              }
              placeholder="sk-ant-..."
            />
            <button
              type="button"
              className="pd-options__password-toggle"
              onClick={() => setShowApiKey((v) => !v)}
              title={showApiKey ? "Hide API key" : "Show API key"}
            >
              {showApiKey ? "Hide" : "Show"}
            </button>
          </div>
          <div style={{ fontSize: 10, color: "var(--pd-text-muted)", marginTop: 4 }}>
            Your API key is stored locally and never sent anywhere except Anthropic's API
          </div>
        </div>

        <button
          type="button"
          className="pd-options__save"
          onClick={handleSave}
        >
          Save
        </button>
      </div>
    </div>
  );
}
