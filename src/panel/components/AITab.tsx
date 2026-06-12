import { useState, useEffect, useCallback } from "react";
import type { Message, AISuggestion } from "../../shared/messages";
import type { ElementData } from "../../shared/types";
import "./ai.css";

type Provider = "anthropic" | "openai" | "gemini";

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Google Gemini",
};

const PROVIDER_PLACEHOLDERS: Record<Provider, string> = {
  anthropic: "sk-ant-...",
  openai: "sk-...",
  gemini: "AIza...",
};

const STORAGE_KEYS: Record<Provider, string> = {
  anthropic: "anthropicApiKey",
  openai: "openaiApiKey",
  gemini: "geminiApiKey",
};

/** Padding (CSS px) around the element when cropping, for visual context */
const CROP_CONTEXT_PX = 24;
/** Cap crop dimensions so the payload stays small */
const MAX_CROP_DIM = 1400;

/**
 * Crop a full-viewport screenshot down to the selected element's bounding
 * rect (plus context padding). The capture is in device pixels while the rect
 * is in CSS px, so the scale factor is derived from the tab's viewport width.
 * Returns null when the element is outside the captured viewport.
 */
async function cropToElement(
  dataUrl: string,
  rect: { x: number; y: number; width: number; height: number },
  viewportWidth: number | undefined
): Promise<string | null> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("screenshot decode failed"));
    img.src = dataUrl;
  });

  const scale = viewportWidth ? img.naturalWidth / viewportWidth : 1;
  let sx = (rect.x - CROP_CONTEXT_PX) * scale;
  let sy = (rect.y - CROP_CONTEXT_PX) * scale;
  let sw = (rect.width + CROP_CONTEXT_PX * 2) * scale;
  let sh = (rect.height + CROP_CONTEXT_PX * 2) * scale;

  // Clamp to the captured area
  sx = Math.max(0, sx);
  sy = Math.max(0, sy);
  sw = Math.min(sw, img.naturalWidth - sx);
  sh = Math.min(sh, img.naturalHeight - sy);
  if (sw < 4 || sh < 4) return null;

  // Downscale large crops
  const downscale = Math.min(1, MAX_CROP_DIM / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * downscale);
  canvas.height = Math.round(sh * downscale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

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
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [apiKeys, setApiKeys] = useState<Record<Provider, string>>({
    anthropic: "",
    openai: "",
    gemini: "",
  });
  const [instruction, setInstruction] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<number>>(new Set());
  const [dismissedEdits, setDismissedEdits] = useState<Set<number>>(new Set());
  const [keyInput, setKeyInput] = useState("");
  const [keySaved, setKeySaved] = useState(false);

  // Load saved provider and API keys from storage
  useEffect(() => {
    chrome.storage.sync.get(
      ["aiProvider", ...Object.values(STORAGE_KEYS)],
      (result) => {
        if (result.aiProvider) setProvider(result.aiProvider);
        setApiKeys({
          anthropic: result.anthropicApiKey || "",
          openai: result.openaiApiKey || "",
          gemini: result.geminiApiKey || "",
        });
      }
    );
  }, []);

  const activeKey = apiKeys[provider];

  // Reset loading states when responses arrive
  useEffect(() => {
    if (nlEditResponse !== null || aiError) setNlLoading(false);
  }, [nlEditResponse, aiError]);

  useEffect(() => {
    if (critiqueResponse !== null || aiError) setCritiqueLoading(false);
  }, [critiqueResponse, aiError]);

  const handleProviderChange = useCallback((p: Provider) => {
    setProvider(p);
    setKeyInput("");
    setKeySaved(false);
    chrome.storage.sync.set({ aiProvider: p });
  }, []);

  const handleSaveKey = useCallback(() => {
    if (!keyInput.trim()) return;
    const storageKey = STORAGE_KEYS[provider];
    const trimmed = keyInput.trim();
    chrome.storage.sync.set({ [storageKey]: trimmed }, () => {
      setApiKeys((prev) => ({ ...prev, [provider]: trimmed }));
      setKeySaved(true);
      setKeyInput("");
      setTimeout(() => setKeySaved(false), 2000);
    });
  }, [keyInput, provider]);

  const handleClearKey = useCallback(() => {
    const storageKey = STORAGE_KEYS[provider];
    chrome.storage.sync.remove(storageKey, () => {
      setApiKeys((prev) => ({ ...prev, [provider]: "" }));
    });
  }, [provider]);

  const handleNLSubmit = useCallback(async () => {
    if (!instruction.trim() || !elementData || !activeKey) return;
    setNlLoading(true);
    onClearNLEdit();
    onClearError();
    setDismissedEdits(new Set());

    // Best-effort: attach a screenshot cropped to the selected element so the
    // model sees the element's actual appearance, not just its CSS values.
    let screenshotDataUrl: string | undefined;
    try {
      const resp: any = await chrome.runtime.sendMessage({
        type: "CAPTURE_SCREENSHOT",
      } satisfies Message);
      if (resp?.dataUrl) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const viewportWidth = tabs[0]?.width;
        screenshotDataUrl =
          (await cropToElement(resp.dataUrl, elementData.rect, viewportWidth)) ?? undefined;
      }
    } catch { /* screenshot is optional — proceed without it */ }

    chrome.runtime.sendMessage({
      type: "AI_NL_EDIT_REQUEST",
      instruction: instruction.trim(),
      selector: elementData.selector,
      computedStyles: elementData.computedStyles,
      apiKey: activeKey,
      provider,
      screenshotDataUrl,
    } satisfies Message);
  }, [instruction, elementData, activeKey, provider, onClearNLEdit, onClearError]);

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
    if (!activeKey) return;
    setCritiqueLoading(true);
    onClearCritique();
    onClearError();
    setDismissedSuggestions(new Set());

    try {
      const screenshotResp: any = await chrome.runtime.sendMessage({
        type: "CAPTURE_SCREENSHOT",
      } satisfies Message);

      if (!screenshotResp?.dataUrl) {
        setCritiqueLoading(false);
        return;
      }

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const pageUrl = tabs[0]?.url || "";

      chrome.runtime.sendMessage({
        type: "AI_CRITIQUE_REQUEST",
        screenshotDataUrl: screenshotResp.dataUrl,
        pageUrl,
        apiKey: activeKey,
        provider,
      } satisfies Message);
    } catch {
      setCritiqueLoading(false);
    }
  }, [activeKey, provider, onClearCritique, onClearError]);

  const handleDismissSuggestion = useCallback((index: number) => {
    setDismissedSuggestions((prev) => new Set(prev).add(index));
  }, []);

  const handleApplyFix = useCallback(
    (selector: string, changes: Array<{ property: string; value: string }>) => {
      // Select the element and wait for confirmation before applying styles
      chrome.runtime.sendMessage({
        type: "SELECT_ELEMENT",
        selector,
      } satisfies Message);

      // Listen for the element to be selected, then apply
      const onSelected = (msg: Message) => {
        if (msg.type === "ELEMENT_SELECTED") {
          chrome.runtime.onMessage.removeListener(onSelected);
          changes.forEach(({ property, value }) => {
            chrome.runtime.sendMessage({
              type: "APPLY_STYLE",
              property,
              value,
            } satisfies Message);
          });
        }
      };
      chrome.runtime.onMessage.addListener(onSelected);

      // Fallback timeout in case ELEMENT_SELECTED never fires
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(onSelected);
      }, 2000);
    },
    []
  );

  const handleHighlightElement = useCallback((selector: string) => {
    chrome.runtime.sendMessage({
      type: "SELECT_ELEMENT",
      selector,
    } satisfies Message);
  }, []);

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "error": return "!";
      case "warning": return "~";
      default: return "i";
    }
  };

  return (
    <div className="pd-ai">
      {/* Provider selector */}
      <div className="pd-ai__provider">
        {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
          <button
            key={p}
            className={`pd-ai__provider-btn ${provider === p ? "pd-ai__provider-btn--active" : ""}`}
            onClick={() => handleProviderChange(p)}
          >
            {PROVIDER_LABELS[p]}
          </button>
        ))}
      </div>

      {/* API key config */}
      {!activeKey ? (
        <div className="pd-ai__key-setup">
          <div className="pd-ai__key-input-wrap">
            <input
              className="pd-ai__input"
              type="password"
              placeholder={PROVIDER_PLACEHOLDERS[provider]}
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
            Stored locally, only sent to {PROVIDER_LABELS[provider]}'s API
          </div>
        </div>
      ) : (
        <div className="pd-ai__key-active">
          <span className="pd-ai__key-active-text">
            {PROVIDER_LABELS[provider]} key configured
          </span>
          <button className="pd-ai__key-clear" onClick={handleClearKey}>
            Remove
          </button>
        </div>
      )}

      {/* Only show features if key is set */}
      {activeKey && (
        <>
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
            <div className="pd-ai__section-title">Design AI Tools</div>
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
                    <div
                      key={i}
                      className="pd-ai__critique-item"
                      onClick={() => handleHighlightElement(suggestion.selector)}
                    >
                      <div className="pd-ai__critique-header">
                        <span
                          className={`pd-ai__suggestion-badge pd-ai__suggestion-badge--${suggestion.category}`}
                        >
                          {suggestion.category}
                        </span>
                        <span className="pd-ai__critique-selector" title={suggestion.selector}>
                          {suggestion.selector}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApplyFix(suggestion.selector, suggestion.suggestedChanges!);
                              }}
                            >
                              Apply Fix
                            </button>
                          )}
                        <button
                          className="pd-ai__suggestion-dismiss"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDismissSuggestion(i);
                          }}
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
        </>
      )}
    </div>
  );
}
