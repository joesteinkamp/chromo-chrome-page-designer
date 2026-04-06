import { useState, useEffect, useCallback } from "react";
import type { Message, AISuggestion } from "../../shared/messages";
import type { ElementData } from "../../shared/types";
import "./ai.css";

interface AITabProps {
  elementData: ElementData | null;
  critiqueResponse: AISuggestion[] | null;
  nlEditResponse: Array<{ property: string; value: string }> | null;
  aiError: string | null;
  onClearCritique: () => void;
  onClearNLEdit: () => void;
  onClearError: () => void;
}

export function AITab({
  elementData,
  critiqueResponse,
  nlEditResponse,
  aiError,
  onClearCritique,
  onClearNLEdit,
  onClearError,
}: AITabProps) {
  const [apiKey, setApiKey] = useState<string>("");
  const [instruction, setInstruction] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<number>>(new Set());
  const [dismissedEdits, setDismissedEdits] = useState<Set<number>>(new Set());

  // Load API key from storage
  useEffect(() => {
    chrome.storage.sync.get(["anthropicApiKey"], (result) => {
      if (result.anthropicApiKey) {
        setApiKey(result.anthropicApiKey);
      }
    });
  }, []);

  // Reset loading states when responses arrive
  useEffect(() => {
    if (nlEditResponse !== null || aiError) {
      setNlLoading(false);
    }
  }, [nlEditResponse, aiError]);

  useEffect(() => {
    if (critiqueResponse !== null || aiError) {
      setCritiqueLoading(false);
    }
  }, [critiqueResponse, aiError]);

  const handleNLSubmit = useCallback(() => {
    if (!instruction.trim() || !elementData || !apiKey) return;
    setNlLoading(true);
    onClearNLEdit();
    onClearError();
    setDismissedEdits(new Set());
    chrome.runtime.sendMessage({
      type: "AI_NL_EDIT_REQUEST",
      instruction: instruction.trim(),
      selector: elementData.selector,
      computedStyles: elementData.computedStyles,
      apiKey,
    } satisfies Message);
  }, [instruction, elementData, apiKey, onClearNLEdit, onClearError]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleNLSubmit();
      }
    },
    [handleNLSubmit]
  );

  const handleApplyChange = useCallback(
    (property: string, value: string) => {
      chrome.runtime.sendMessage({
        type: "APPLY_STYLE",
        property,
        value,
      } satisfies Message);
    },
    []
  );

  const handleApplyAll = useCallback(() => {
    if (!nlEditResponse) return;
    nlEditResponse.forEach(({ property, value }, i) => {
      if (!dismissedEdits.has(i)) {
        chrome.runtime.sendMessage({
          type: "APPLY_STYLE",
          property,
          value,
        } satisfies Message);
      }
    });
  }, [nlEditResponse, dismissedEdits]);

  const handleDismissEdit = useCallback((index: number) => {
    setDismissedEdits((prev) => new Set(prev).add(index));
  }, []);

  const handleRunCritique = useCallback(async () => {
    if (!apiKey) return;
    setCritiqueLoading(true);
    onClearCritique();
    onClearError();
    setDismissedSuggestions(new Set());

    try {
      const screenshotResp: any = await chrome.runtime.sendMessage({
        type: "CAPTURE_SCREENSHOT",
      } satisfies Message);

      if (!screenshotResp?.dataUrl) {
        onClearError();
        setCritiqueLoading(false);
        return;
      }

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const pageUrl = tabs[0]?.url || "";

      chrome.runtime.sendMessage({
        type: "AI_CRITIQUE_REQUEST",
        screenshotDataUrl: screenshotResp.dataUrl,
        pageUrl,
        apiKey,
      } satisfies Message);
    } catch (err) {
      setCritiqueLoading(false);
    }
  }, [apiKey, onClearCritique, onClearError]);

  const handleDismissSuggestion = useCallback((index: number) => {
    setDismissedSuggestions((prev) => new Set(prev).add(index));
  }, []);

  const handleApplyFix = useCallback(
    (changes: Array<{ property: string; value: string }>) => {
      changes.forEach(({ property, value }) => {
        chrome.runtime.sendMessage({
          type: "APPLY_STYLE",
          property,
          value,
        } satisfies Message);
      });
    },
    []
  );

  const [keyInput, setKeyInput] = useState("");
  const [keySaved, setKeySaved] = useState(false);

  const handleSaveKey = useCallback(() => {
    if (!keyInput.trim()) return;
    chrome.storage.sync.set({ anthropicApiKey: keyInput.trim() }, () => {
      setApiKey(keyInput.trim());
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2000);
    });
  }, [keyInput]);

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return "!";
      case "warning":
        return "~";
      default:
        return "i";
    }
  };

  // No API key prompt — inline input
  if (!apiKey) {
    return (
      <div className="pd-ai">
        <div className="pd-ai__no-key">
          <div className="pd-ai__no-key-text">
            Enter your Anthropic API key to enable AI features
          </div>
          <div className="pd-ai__key-input-wrap">
            <input
              className="pd-ai__input"
              type="password"
              placeholder="sk-ant-..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveKey(); }}
            />
            <button
              className="pd-ai__submit"
              onClick={handleSaveKey}
              disabled={!keyInput.trim()}
            >
              {keySaved ? "Saved!" : "Save"}
            </button>
          </div>
          <div className="pd-ai__key-note">
            Stored locally, only sent to Anthropic's API
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pd-ai">
      {/* Natural Language Edit */}
      <div className="pd-ai__section">
        <div className="pd-ai__section-title">Natural Language Edit</div>
        <div className="pd-ai__input-wrap">
          <input
            className="pd-ai__input"
            type="text"
            placeholder="Describe what you want to change..."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={nlLoading || !elementData}
          />
          <button
            className="pd-ai__submit"
            onClick={handleNLSubmit}
            disabled={nlLoading || !instruction.trim() || !elementData}
          >
            {nlLoading ? "..." : "Apply"}
          </button>
        </div>
        {!elementData && (
          <div className="pd-ai__hint">Select an element first</div>
        )}
      </div>

      {/* NL Edit Loading */}
      {nlLoading && (
        <div className="pd-ai__loading">
          <div className="pd-ai__spinner" />
          <span>Generating changes...</span>
        </div>
      )}

      {/* NL Edit Response */}
      {nlEditResponse && nlEditResponse.length > 0 && (
        <div className="pd-ai__section">
          <div className="pd-ai__section-header">
            <div className="pd-ai__section-title">Suggested Changes</div>
            <button className="pd-ai__apply-all" onClick={handleApplyAll}>
              Apply All
            </button>
          </div>
          <div className="pd-ai__suggestions">
            {nlEditResponse.map(({ property, value }, i) =>
              dismissedEdits.has(i) ? null : (
                <div key={i} className="pd-ai__suggestion">
                  <div className="pd-ai__suggestion-content">
                    <code className="pd-ai__suggestion-prop">{property}</code>
                    <code className="pd-ai__suggestion-value">{value}</code>
                  </div>
                  <div className="pd-ai__suggestion-actions">
                    <button
                      className="pd-ai__suggestion-apply"
                      onClick={() => handleApplyChange(property, value)}
                    >
                      Apply
                    </button>
                    <button
                      className="pd-ai__suggestion-dismiss"
                      onClick={() => handleDismissEdit(i)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* AI Error */}
      {aiError && (
        <div className="pd-ai__error">
          <span>{aiError}</span>
          <button className="pd-ai__error-dismiss" onClick={onClearError}>
            Dismiss
          </button>
        </div>
      )}

      {/* Design Critique */}
      <div className="pd-ai__section pd-ai__section--critique">
        <div className="pd-ai__section-title">Design Critique</div>
        <button
          className="pd-ai__critique-btn"
          onClick={handleRunCritique}
          disabled={critiqueLoading}
        >
          {critiqueLoading ? "Analyzing..." : "Run Design Critique"}
        </button>
      </div>

      {/* Critique Loading */}
      {critiqueLoading && (
        <div className="pd-ai__loading">
          <div className="pd-ai__spinner" />
          <span>Analyzing design...</span>
        </div>
      )}

      {/* Critique Response */}
      {critiqueResponse && critiqueResponse.length > 0 && (
        <div className="pd-ai__section">
          <div className="pd-ai__section-title">
            Critique Results ({critiqueResponse.length})
          </div>
          <div className="pd-ai__suggestions">
            {critiqueResponse.map((suggestion, i) =>
              dismissedSuggestions.has(i) ? null : (
                <div key={i} className="pd-ai__critique-item">
                  <div className="pd-ai__critique-header">
                    <span
                      className={`pd-ai__suggestion-badge pd-ai__suggestion-badge--${suggestion.category}`}
                    >
                      {suggestion.category}
                    </span>
                    <span
                      className={`pd-ai__severity pd-ai__severity--${suggestion.severity}`}
                    >
                      {severityIcon(suggestion.severity)}
                    </span>
                  </div>
                  <div className="pd-ai__critique-message">
                    {suggestion.message}
                  </div>
                  <div className="pd-ai__suggestion-actions">
                    {suggestion.suggestedChanges &&
                      suggestion.suggestedChanges.length > 0 && (
                        <button
                          className="pd-ai__suggestion-apply"
                          onClick={() =>
                            handleApplyFix(suggestion.suggestedChanges!)
                          }
                        >
                          Apply Fix
                        </button>
                      )}
                    <button
                      className="pd-ai__suggestion-dismiss"
                      onClick={() => handleDismissSuggestion(i)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
