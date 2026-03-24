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
  const { elementData, isConnected } = useElementData();
  const sendStyleChange = useStyleChange();
  const [activeTab, setActiveTab] = useState<Tab>("design");
  const [changes, setChanges] = useState<Change[]>([]);
  const [pageUrl, setPageUrl] = useState("");
  const [editMode, setEditMode] = useState(true);

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
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) setPageUrl(tabs[0].url);
    });

    chrome.runtime.sendMessage({ type: "GET_CHANGES" } satisfies Message);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  // --- Change tracking handlers ---

  const handleUndo = useCallback((changeId: string) => {
    chrome.runtime.sendMessage({
      type: "UNDO_CHANGE",
      changeId,
    } satisfies Message);
  }, []);

  const handleUndoAll = useCallback(() => {
    chrome.runtime.sendMessage({ type: "UNDO_ALL" } satisfies Message);
  }, []);

  const handleExportJSON = useCallback(() => {
    const json = exportAsJSON(pageUrl, changes);
    navigator.clipboard.writeText(json);
  }, [pageUrl, changes]);

  const handleExportSummary = useCallback(() => {
    const summary = exportAsSummary(pageUrl, changes);
    navigator.clipboard.writeText(summary);
  }, [pageUrl, changes]);

  // --- Persistence handlers ---

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
    chrome.runtime.sendMessage({
      type: "CAPTURE_SCREENSHOT",
    } satisfies Message);
  }, []);

  return (
    <div className="pd-panel">
      <header className="pd-panel__header">
        <div className="pd-panel__logo">
          <span className="pd-panel__logo-icon">◆</span>
          Page Designer
        </div>
        <div className="pd-panel__header-actions">
          {changes.length > 0 && (
            <button
              className="pd-panel__header-btn"
              onClick={handleSaveEdits}
              title="Save edits for this page"
            >
              Save
            </button>
          )}
          <button
            className="pd-panel__header-btn"
            onClick={handleLoadEdits}
            title="Restore saved edits"
          >
            Restore
          </button>
          <button
            className="pd-panel__header-btn"
            onClick={handleScreenshot}
            title="Download screenshot"
          >
            📷
          </button>
          <button
            className={`pd-panel__toggle ${editMode ? "pd-panel__toggle--on" : ""}`}
            onClick={handleToggleEditMode}
            title={editMode ? "Disable edit mode" : "Enable edit mode"}
          >
            <span className="pd-panel__toggle-track">
              <span className="pd-panel__toggle-thumb" />
            </span>
            {editMode ? "On" : "Off"}
          </button>
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
