import React, { useState, useCallback, useEffect, useRef } from "react";
import type { Change } from "../../shared/types";
import "./changes.css";

interface Props {
  changes: Change[];
  onUndo: (changeId: string) => void;
  onUndoAll: () => void;
  onExportJSON: () => void;
  onExportSummary: () => void;
  url: string;
}

const TYPE_ICONS: Record<Change["type"], string> = {
  style: "\uD83C\uDFA8",
  text: "\uD83D\uDCDD",
  move: "\u2195",
  resize: "\u2194",
  image: "\uD83D\uDDBC",
};

function relativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ChangesTab({
  changes,
  onUndo,
  onUndoAll,
  onExportJSON,
  onExportSummary,
  url,
}: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const handleCopyJSON = useCallback(() => {
    onExportJSON();
    showToast("Copied!");
  }, [onExportJSON, showToast]);

  const handleCopySummary = useCallback(() => {
    onExportSummary();
    showToast("Copied!");
  }, [onExportSummary, showToast]);

  const hasChanges = changes.length > 0;
  const sortedChanges = [...changes].sort(
    (a, b) => b.timestamp - a.timestamp
  );

  return (
    <div className="pd-changes">
      {toast && <div className="pd-changes__toast">{toast}</div>}

      <div className="pd-changes__toolbar">
        <span className="pd-changes__badge">
          {changes.length} {changes.length === 1 ? "change" : "changes"}
        </span>
        <div className="pd-changes__toolbar-spacer" />
        {hasChanges && (
          <button
            type="button"
            className="pd-changes__btn pd-changes__btn--danger"
            onClick={onUndoAll}
          >
            Undo All
          </button>
        )}
        <button
          type="button"
          className="pd-changes__btn"
          onClick={handleCopyJSON}
          disabled={!hasChanges}
        >
          Copy JSON
        </button>
        <button
          type="button"
          className="pd-changes__btn"
          onClick={handleCopySummary}
          disabled={!hasChanges}
        >
          Copy Summary
        </button>
      </div>

      {!hasChanges ? (
        <div className="pd-changes__empty">
          No changes yet — start editing to track changes
        </div>
      ) : (
        <div className="pd-changes__list">
          {sortedChanges.map((change) => (
            <div key={change.id} className="pd-changes__item">
              <span className="pd-changes__item-icon">
                {TYPE_ICONS[change.type]}
              </span>
              <div className="pd-changes__item-body">
                <div className="pd-changes__item-desc">
                  {change.description}
                </div>
                <div className="pd-changes__item-time">
                  {relativeTime(change.timestamp)}
                </div>
              </div>
              <button
                type="button"
                className="pd-changes__item-undo"
                onClick={() => onUndo(change.id)}
              >
                Undo
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
