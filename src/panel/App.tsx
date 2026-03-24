import { useState, useCallback, useEffect } from "react";
import { useElementData } from "./hooks/useElementData";
import { useStyleChange } from "./hooks/useStyleChange";
import { ElementInfo } from "./components/ElementInfo";
import { DesignTab } from "./components/DesignTab";
import { TypographyTab } from "./components/TypographyTab";
import { ChangesTab } from "./components/ChangesTab";
import { AITab } from "./components/AITab";
import { exportAsJSON, exportAsSummary } from "../shared/export";
import type { Change } from "../shared/types";
import type { Message } from "../shared/messages";

type Tab = "design" | "typography" | "changes" | "ai";

export function App() {
  const { elementData, isConnected } = useElementData();
  const sendStyleChange = useStyleChange();
  const [activeTab, setActiveTab] = useState<Tab>("design");
  const [changes, setChanges] = useState<Change[]>([]);
  const [pageUrl, setPageUrl] = useState("");

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    explanation: string;
    appliedCount: number;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Listen for change updates and AI responses
  useEffect(() => {
    const listener = (message: Message) => {
      switch (message.type) {
        case "CHANGES_RESPONSE":
          setChanges(message.changes);
          break;
        case "AI_RESPONSE":
          handleAIResponse(message);
          break;
        case "AI_ERROR":
          setAiLoading(false);
          setAiError(message.error);
          setAiResult(null);
          break;
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    // Get current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) setPageUrl(tabs[0].url);
    });

    // Load existing changes
    chrome.runtime.sendMessage({ type: "GET_CHANGES" } satisfies Message);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  // --- AI handlers ---

  const handleAIResponse = useCallback(
    (msg: Extract<Message, { type: "AI_RESPONSE" }>) => {
      // Forward changes to content script for application
      chrome.runtime.sendMessage(
        {
          type: "APPLY_AI_CHANGES",
          styleChanges: msg.styleChanges,
          textContent: msg.textContent,
        } satisfies Message,
        (response: any) => {
          setAiLoading(false);
          setAiResult({
            explanation: msg.explanation,
            appliedCount: response?.appliedCount ?? msg.styleChanges.length,
          });
          setAiError(null);
          // Refresh changes
          chrome.runtime.sendMessage({
            type: "GET_CHANGES",
          } satisfies Message);
        }
      );
    },
    []
  );

  const handleApplyAI = useCallback(
    (prompt: string) => {
      if (!elementData) return;
      setAiLoading(true);
      setAiResult(null);
      setAiError(null);

      chrome.runtime.sendMessage({
        type: "AI_REQUEST",
        prompt,
        elementHTML: elementData.outerHTML,
        computedStyles: elementData.computedStyles,
        selector: elementData.selector,
      } satisfies Message);
    },
    [elementData]
  );

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
          <span
            className={`pd-panel__status ${isConnected ? "pd-panel__status--active" : ""}`}
          >
            {isConnected ? "Active" : "Inactive"}
          </span>
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
                className={`pd-panel__tab ${activeTab === "typography" ? "pd-panel__tab--active" : ""}`}
                onClick={() => setActiveTab("typography")}
              >
                Type
              </button>
              <button
                className={`pd-panel__tab ${activeTab === "ai" ? "pd-panel__tab--active" : ""}`}
                onClick={() => setActiveTab("ai")}
              >
                AI
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
              {activeTab === "typography" && (
                <TypographyTab
                  computedStyles={elementData.computedStyles}
                  onStyleChange={sendStyleChange}
                />
              )}
              {activeTab === "ai" && (
                <AITab
                  elementData={elementData}
                  onApplyAI={handleApplyAI}
                  isLoading={aiLoading}
                  lastResult={aiResult}
                  error={aiError}
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
