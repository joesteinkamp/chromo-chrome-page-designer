import { useState, useCallback, useEffect, useRef } from "react";
import { useElementData } from "./hooks/useElementData";
import { useStyleChange } from "./hooks/useStyleChange";
import { ElementInfo } from "./components/ElementInfo";
import { DesignTab } from "./components/DesignTab";
import { ChangesTab } from "./components/ChangesTab";
import { exportAsJSON, exportAsSummary } from "../shared/export";
import type { Change } from "../shared/types";
import type { Message } from "../shared/messages";

type Tab = "design" | "changes";

export function App() {
  const { elementData, isConnected, setElementData } = useElementData();
  const sendStyleChange = useStyleChange();
  const [activeTab, setActiveTab] = useState<Tab>("design");
  const [changes, setChanges] = useState<Change[]>([]);
  const [canRedo, setCanRedo] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const [editMode, setEditMode] = useState(true);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const sendMenuRef = useRef<HTMLDivElement>(null);

  const handleToggleEditMode = useCallback(() => {
    const next = !editMode;
    setEditMode(next);
    chrome.runtime.sendMessage({
      type: next ? "ACTIVATE" : "DEACTIVATE",
    } satisfies Message);
  }, [editMode]);

  useEffect(() => {
    const listener = (message: Message) => {
      if (message.type === "CHANGES_RESPONSE") {
        setChanges(message.changes);
        setCanRedo(message.canRedo);
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) setPageUrl(tabs[0].url);
    });

    chrome.runtime.sendMessage({ type: "GET_CHANGES" } satisfies Message);

    // When the user switches tabs, reset to inactive
    const onTabActivated = () => {
      setEditMode(false);
      setElementData(null);
      setChanges([]);
      setCanRedo(false);

      // Update URL for the new tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) setPageUrl(tabs[0].url);
      });
    };

    chrome.tabs.onActivated.addListener(onTabActivated);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      chrome.tabs.onActivated.removeListener(onTabActivated);
    };
  }, []);

  // Close send menu on outside click
  useEffect(() => {
    if (!sendMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sendMenuRef.current && !sendMenuRef.current.contains(e.target as Node)) {
        setSendMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [sendMenuOpen]);

  // --- Undo / Redo ---

  const handleUndo = useCallback((changeId: string) => {
    chrome.runtime.sendMessage({
      type: "UNDO_CHANGE",
      changeId,
    } satisfies Message);
  }, []);

  const handleUndoLast = useCallback(() => {
    if (changes.length > 0) {
      handleUndo(changes[changes.length - 1].id);
    }
  }, [changes, handleUndo]);

  const handleRedo = useCallback(() => {
    chrome.runtime.sendMessage({ type: "REDO" } satisfies Message);
  }, []);

  const handleUndoAll = useCallback(() => {
    chrome.runtime.sendMessage({ type: "UNDO_ALL" } satisfies Message);
  }, []);

  // --- Export ---

  const handleExportJSON = useCallback(() => {
    const json = exportAsJSON(pageUrl, changes);
    navigator.clipboard.writeText(json);
  }, [pageUrl, changes]);

  const handleExportSummary = useCallback(() => {
    const summary = exportAsSummary(pageUrl, changes);
    navigator.clipboard.writeText(summary);
  }, [pageUrl, changes]);

  // --- Persistence ---

  const handleSaveEdits = useCallback(() => {
    chrome.runtime.sendMessage({
      type: "SAVE_EDITS",
      url: pageUrl,
      changes,
    } satisfies Message);
  }, [pageUrl, changes]);

  const handleLoadEdits = useCallback(() => {
    chrome.runtime.sendMessage(
      { type: "LOAD_EDITS", url: pageUrl } satisfies Message,
      (response: any) => {
        if (response?.changes) {
          chrome.runtime.sendMessage({
            type: "REPLAY_CHANGES",
            changes: response.changes,
          } satisfies Message);
        }
      }
    );
  }, [pageUrl]);

  // --- Screenshot ---

  const handleScreenshot = useCallback(() => {
    chrome.runtime.sendMessage(
      { type: "CAPTURE_SCREENSHOT" } satisfies Message,
      (response: any) => {
        if (response?.dataUrl) {
          // Trigger download
          const link = document.createElement("a");
          link.href = response.dataUrl;
          link.download = `page-designer-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
      }
    );
  }, []);

  const handleCopyScreenshot = useCallback(() => {
    chrome.runtime.sendMessage(
      { type: "CAPTURE_SCREENSHOT" } satisfies Message,
      async (response: any) => {
        if (response?.dataUrl) {
          try {
            const res = await fetch(response.dataUrl);
            const blob = await res.blob();
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
          } catch {
            // Fallback: just copy the data URL
            navigator.clipboard.writeText(response.dataUrl);
          }
        }
      }
    );
  }, []);

  // --- Send menu actions ---

  const sendMenuActions = [
    {
      label: "Send to Claude Code",
      action: () => {
        const json = exportAsJSON(pageUrl, changes);
        navigator.clipboard.writeText(
          `Apply these visual changes to the codebase:\n\n${json}`
        );
        setSendMenuOpen(false);
      },
    },
    {
      label: "Send to Codex",
      action: () => {
        const json = exportAsJSON(pageUrl, changes);
        navigator.clipboard.writeText(
          `Apply these visual changes to the codebase:\n\n${json}`
        );
        setSendMenuOpen(false);
      },
    },
    {
      label: "Copy Screenshot",
      action: () => {
        handleCopyScreenshot();
        setSendMenuOpen(false);
      },
    },
    {
      label: "Copy Change Instructions",
      action: () => {
        handleExportSummary();
        setSendMenuOpen(false);
      },
    },
    {
      label: "Save Screenshot",
      action: () => {
        handleScreenshot();
        setSendMenuOpen(false);
      },
    },
  ];

  return (
    <div className="pd-panel">
      <header className="pd-panel__header">
        <div className="pd-panel__header-left">
          <button
            className={`pd-panel__toggle ${editMode ? "pd-panel__toggle--on" : ""}`}
            onClick={handleToggleEditMode}
            title={editMode ? "Disable edit mode" : "Enable edit mode"}
          >
            <span className="pd-panel__toggle-track">
              <span className="pd-panel__toggle-thumb" />
            </span>
          </button>
          <button
            className={`pd-panel__icon-btn ${changes.length === 0 ? "pd-panel__icon-btn--disabled" : ""}`}
            onClick={handleUndoLast}
            disabled={changes.length === 0}
            title="Undo"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2.5 8.5C2.5 8.5 4 4 9 4c3 0 4.5 2 4.5 4.5S12 13 9 13H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.5 6L2.5 8.5 5.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </button>
          <button
            className={`pd-panel__icon-btn ${!canRedo ? "pd-panel__icon-btn--disabled" : ""}`}
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13.5 8.5C13.5 8.5 12 4 7 4c-3 0-4.5 2-4.5 4.5S4 13 7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.5 6L13.5 8.5 10.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </button>
        </div>

        <div className="pd-panel__header-right">
          <div className="pd-panel__send-wrap" ref={sendMenuRef}>
            <button
              className={`pd-panel__send-btn ${changes.length === 0 ? "pd-panel__send-btn--disabled" : ""}`}
              onClick={() => setSendMenuOpen(!sendMenuOpen)}
              disabled={changes.length === 0}
            >
              Send Changes
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {sendMenuOpen && (
              <div className="pd-panel__send-menu">
                {sendMenuActions.map((item) => (
                  <button
                    key={item.label}
                    className="pd-panel__send-menu-item"
                    onClick={item.action}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="pd-panel__body">
        {elementData ? (
          <>
            <ElementInfo data={elementData} />
            <div className="pd-panel__tabs">
              <button
                className={`pd-panel__tab ${activeTab === "design" ? "pd-panel__tab--active" : ""}`}
                onClick={() => setActiveTab("design")}
              >
                Design
              </button>
              <button
                className={`pd-panel__tab ${activeTab === "changes" ? "pd-panel__tab--active" : ""}`}
                onClick={() => setActiveTab("changes")}
              >
                Changes
                {changes.length > 0 && (
                  <span className="pd-panel__tab-badge">{changes.length}</span>
                )}
              </button>
            </div>
            <div className="pd-panel__content">
              {activeTab === "design" && (
                <DesignTab
                  data={elementData}
                  onStyleChange={sendStyleChange}
                />
              )}
              {activeTab === "changes" && (
                <ChangesTab
                  changes={changes}
                  onUndo={handleUndo}
                  onUndoAll={handleUndoAll}
                  onExportJSON={handleExportJSON}
                  onExportSummary={handleExportSummary}
                  onSave={handleSaveEdits}
                  onRestore={handleLoadEdits}
                  url={pageUrl}
                />
              )}
            </div>
          </>
        ) : (
          <div className="pd-panel__empty">
            <div className="pd-panel__empty-icon">◇</div>
            <div className="pd-panel__empty-title">Select an element</div>
            <div className="pd-panel__empty-subtitle">
              Hover over the page and click an element to inspect and edit its
              properties
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
