import React, { useState, useCallback } from "react";
import type { ElementData } from "../../shared/types";
import "./ai.css";

interface Props {
  elementData: ElementData | null;
  onApplyAI: (prompt: string) => void;
  isLoading: boolean;
  lastResult: { explanation: string; appliedCount: number } | null;
  error: string | null;
}

export function AITab({
  elementData,
  onApplyAI,
  isLoading,
  lastResult,
  error,
}: Props) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;
    onApplyAI(trimmed);
  }, [prompt, isLoading, onApplyAI]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  if (!elementData) {
    return (
      <div className="pd-ai">
        <div className="pd-ai__no-element">
          Select an element first to use AI editing
        </div>
      </div>
    );
  }

  const elementLabel = `${elementData.tag}${
    elementData.classes.length > 0 ? `.${elementData.classes[0]}` : ""
  }`;
  const dims = `${Math.round(elementData.rect.width)} x ${Math.round(
    elementData.rect.height
  )}`;

  const canSubmit = prompt.trim().length > 0 && !isLoading;

  return (
    <div className="pd-ai">
      <div className="pd-ai__context">
        Selected: {elementLabel} &mdash; {dims}
      </div>

      <div className="pd-ai__prompt">
        <textarea
          className="pd-ai__textarea"
          placeholder="Describe what you want to change..."
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          type="button"
          className="pd-ai__submit"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {isLoading ? (
            <>
              <span className="pd-ai__spinner" />
              Applying...
            </>
          ) : (
            "Apply"
          )}
        </button>
      </div>

      {lastResult && !error && (
        <div className="pd-ai__result pd-ai__result--success">
          {lastResult.explanation}
          <span className="pd-ai__result-count">
            {lastResult.appliedCount}{" "}
            {lastResult.appliedCount === 1 ? "change" : "changes"} applied
          </span>
        </div>
      )}

      {error && (
        <div className="pd-ai__result pd-ai__result--error">{error}</div>
      )}
    </div>
  );
}
