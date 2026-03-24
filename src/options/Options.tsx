import React, { useState, useEffect, useCallback } from "react";
import "./options.css";

interface Settings {
  aiProvider: "claude" | "openai";
  apiKey: string;
  model: string;
  defaultUnit: "px" | "rem" | "em";
}

const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  claude: [
    { value: "claude-sonnet-4-20250514", label: "claude-sonnet-4-20250514" },
    { value: "claude-haiku-4-5-20251001", label: "claude-haiku-4-5-20251001" },
  ],
  openai: [
    { value: "gpt-4o", label: "gpt-4o" },
    { value: "gpt-4o-mini", label: "gpt-4o-mini" },
  ],
};

const DEFAULT_SETTINGS: Settings = {
  aiProvider: "claude",
  apiKey: "",
  model: "claude-sonnet-4-20250514",
  defaultUnit: "px",
};

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [version, setVersion] = useState("");

  // Load settings on mount
  useEffect(() => {
    const manifest = chrome.runtime.getManifest();
    setVersion(manifest.version);

    chrome.storage.sync.get(
      ["aiProvider", "apiKey", "model", "defaultUnit"],
      (result) => {
        setSettings({
          aiProvider: result.aiProvider || DEFAULT_SETTINGS.aiProvider,
          apiKey: result.apiKey || DEFAULT_SETTINGS.apiKey,
          model: result.model || DEFAULT_SETTINGS.model,
          defaultUnit: result.defaultUnit || DEFAULT_SETTINGS.defaultUnit,
        });
      }
    );
  }, []);

  const handleProviderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const provider = e.target.value as "claude" | "openai";
      const defaultModel = MODEL_OPTIONS[provider][0].value;
      setSettings((prev) => ({
        ...prev,
        aiProvider: provider,
        model: defaultModel,
      }));
    },
    []
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSettings((prev) => ({ ...prev, model: e.target.value }));
    },
    []
  );

  const handleApiKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSettings((prev) => ({ ...prev, apiKey: e.target.value }));
    },
    []
  );

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

  const models = MODEL_OPTIONS[settings.aiProvider] || [];

  return (
    <div className="pd-options">
      <div className="pd-options__header">
        <div className="pd-options__title">Page Designer Settings</div>
        {version && (
          <div className="pd-options__version">v{version}</div>
        )}
      </div>

      {/* AI Configuration */}
      <div className="pd-options__section">
        <div className="pd-options__section-title">AI Configuration</div>

        <div className="pd-options__field">
          <label className="pd-options__label">API Provider</label>
          <select
            className="pd-options__select"
            value={settings.aiProvider}
            onChange={handleProviderChange}
          >
            <option value="claude">Claude</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>

        <div className="pd-options__field">
          <label className="pd-options__label">API Key</label>
          <div className="pd-options__password-wrap">
            <input
              className="pd-options__input"
              type={showPassword ? "text" : "password"}
              value={settings.apiKey}
              onChange={handleApiKeyChange}
              placeholder="Enter your API key"
            />
            <button
              type="button"
              className="pd-options__password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              title={showPassword ? "Hide" : "Show"}
            >
              {showPassword ? "\u2299" : "\u25C9"}
            </button>
          </div>
        </div>

        <div className="pd-options__field">
          <label className="pd-options__label">Model</label>
          <select
            className="pd-options__select"
            value={settings.model}
            onChange={handleModelChange}
          >
            {models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
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
      </div>
    </div>
  );
}
