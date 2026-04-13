import React, { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import type { Change } from "../../shared/types";
import { generateVisualDiffAnnotations, collapseBatches } from "../../shared/export";
import type { Message } from "../../shared/messages";
import { PaletteIcon, TextIcon, MoveIcon, ResizeIcon, ImageIcon, DeleteIcon, HideIcon, WrapIcon, DuplicateIcon, CommentIcon } from "../icons";
import "./changes.css";

interface Props {
  changes: Change[];
  onUndo: (changeId: string) => void;
  onUndoAll: () => void;
  onRedo: () => void;
  onRestore: () => void;
  url: string;
}

const TYPE_ICONS: Record<Change["type"], ReactNode> = {
  style: <PaletteIcon size={14} />,
  text: <TextIcon size={14} />,
  move: <MoveIcon size={14} />,
  resize: <ResizeIcon size={14} />,
  image: <ImageIcon size={14} />,
  delete: <DeleteIcon size={14} />,
  hide: <HideIcon size={14} />,
  wrap: <WrapIcon size={14} />,
  duplicate: <DuplicateIcon size={14} />,
  comment: <CommentIcon size={14} />,
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

/** Group changes by selector for display */
interface ChangeGroup {
  selector: string;
  changes: Change[];
}

function groupChanges(changes: Change[]): ChangeGroup[] {
  const collapsed = collapseBatches(changes);
  const map = new Map<string, Change[]>();
  for (const c of collapsed) {
    const existing = map.get(c.selector) || [];
    existing.push(c);
    map.set(c.selector, existing);
  }
  return Array.from(map.entries()).map(([selector, changes]) => ({
    selector,
    changes: changes.sort((a, b) => b.timestamp - a.timestamp),
  }));
}

export function ChangesTab({
  changes,
  onUndo,
  onUndoAll,
  onRedo,
  onRestore,
  url,
}: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("grouped");
  const [showDiffOverlay, setShowDiffOverlay] = useState(false);
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

  const handleToggleDiff = useCallback(() => {
    setShowDiffOverlay((v) => !v);
    // Send message to content script to highlight changed elements
    if (!showDiffOverlay) {
      const annotations = generateVisualDiffAnnotations(changes);
      // We'll just show the annotations in the panel
      showToast(`${annotations.length} elements changed`);
    }
  }, [showDiffOverlay, changes, showToast]);

  const hasChanges = changes.length > 0;
  const groups = groupChanges(changes);
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
          <>
            <button
              type="button"
              className="pd-changes__btn pd-changes__btn--small"
              onClick={() => setViewMode(viewMode === "list" ? "grouped" : "list")}
              title={viewMode === "list" ? "Group by element" : "Show list"}
            >
              {viewMode === "list" ? "Group" : "List"}
            </button>
            <button
              type="button"
              className={`pd-changes__btn pd-changes__btn--small${showDiffOverlay ? " pd-changes__btn--active" : ""}`}
              onClick={handleToggleDiff}
              title="Show visual diff summary"
            >
              Diff
            </button>
            <button
              type="button"
              className="pd-changes__btn"
              onClick={onRedo}
              title="Redo last undone change"
            >
              Redo
            </button>
            <button
              type="button"
              className="pd-changes__btn pd-changes__btn--danger"
              onClick={onUndoAll}
            >
              Undo All
            </button>
          </>
        )}
      </div>

      <div className="pd-changes__toolbar pd-changes__toolbar--secondary">
        <button
          type="button"
          className="pd-changes__btn"
          onClick={() => { onRestore(); showToast("Restoring..."); }}
        >
          Restore Previously Saved Changes
        </button>
      </div>

      {/* Visual diff annotations */}
      {showDiffOverlay && hasChanges && (
        <div className="pd-changes__diff">
          <div className="pd-changes__diff-title">Changed Elements</div>
          {groups.map((group) => (
            <div key={group.selector} className="pd-changes__diff-item">
              <span className="pd-changes__diff-selector">{group.selector}</span>
              <span className="pd-changes__diff-count">
                {group.changes.length} change{group.changes.length > 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {!hasChanges ? (
        <div className="pd-changes__empty">
          No changes yet — start editing to track changes
        </div>
      ) : viewMode === "grouped" ? (
        <div className="pd-changes__list">
          {groups.map((group) => (
            <div key={group.selector} className="pd-changes__group">
              <div className="pd-changes__group-header">
                <span className="pd-changes__group-selector">{group.selector}</span>
                <span className="pd-changes__group-count">
                  {group.changes.length}
                </span>
              </div>
              {group.changes.map((change) => (
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
          ))}
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
