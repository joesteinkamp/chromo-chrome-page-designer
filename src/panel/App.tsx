import { useState, useCallback, useEffect, useRef } from "react";
import { useElementData } from "./hooks/useElementData";
import { useStyleChange } from "./hooks/useStyleChange";
import { ElementInfo } from "./components/ElementInfo";
import { DesignTab } from "./components/DesignTab";
import { ChangesTab } from "./components/ChangesTab";
import { exportAsJSON, exportAsSummary, type ComponentContext } from "../shared/export";
import type { Change } from "../shared/types";
import type { Message } from "../shared/messages";

type Tab = "design" | "changes";

export function App() {
  const { elementData, isConnected, setElementData, multiSelectCount } = useElementData();
  const sendStyleChange = useStyleChange();
  const [activeTab, setActiveTab] = useState<Tab>("design");
  const [changes, setChanges] = useState<Change[]>([]);
  const [canRedo, setCanRedo] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const [editMode, setEditMode] = useState(true);
  const [multiEdit, setMultiEdit] = useState(false);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const sendMenuRef = useRef<HTMLDivElement>(null);
  const [hasSavedChanges, setHasSavedChanges] = useState(false);
  const [savedChangesDismissed, setSavedChangesDismissed] = useState(false);
  const componentMapRef = useRef(new Map<string, ComponentContext>());

  // Accumulate component context as elements are selected
  useEffect(() => {
    if (elementData?.componentInfo?.componentName && elementData.selector) {
      componentMapRef.current.set(elementData.selector, {
        framework: elementData.componentInfo.framework,
        componentName: elementData.componentInfo.componentName,
        componentHierarchy: elementData.componentInfo.componentHierarchy,
        sourceFile: elementData.componentInfo.sourceFile,
        sourceLine: elementData.componentInfo.sourceLine,
      });
    }
  }, [elementData]);

  const handleToggleEditMode = useCallback(() => {
    const next = !editMode;
    setEditMode(next);
    if (!next) {
      setMultiEdit(false);
    }
    chrome.runtime.sendMessage({
      type: next ? "ACTIVATE" : "DEACTIVATE",
    } satisfies Message);
  }, [editMode]);

  const handleToggleMultiEdit = useCallback(() => {
    const next = !multiEdit;
    setMultiEdit(next);
    chrome.runtime.sendMessage({
      type: "TOGGLE_MULTI_EDIT",
      enabled: next,
    } satisfies Message);
  }, [multiEdit]);

  // Listen for change updates
  useEffect(() => {
    const listener = (message: Message) => {
      switch (message.type) {
        case "CHANGES_RESPONSE":
          setChanges(message.changes);
          setCanRedo(message.canRedo);
          break;
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        setPageUrl(tabs[0].url);
        chrome.runtime.sendMessage(
          { type: "LOAD_EDITS", url: tabs[0].url } satisfies Message,
          (response: any) => {
            if (response?.changes?.length > 0) {
              setHasSavedChanges(true);
            }
          }
        );
      }
    });

    chrome.runtime.sendMessage({ type: "GET_CHANGES" } satisfies Message);

    // When the user switches tabs, reset to inactive
    const onTabActivated = () => {
      setEditMode(false);
      setMultiEdit(false);
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

  // --- Undo / Redo / Change tracking handlers ---

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

  // --- Persistence ---

  const handleLoadSaved = useCallback(() => {
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
    setHasSavedChanges(false);
    setSavedChangesDismissed(false);
  }, [pageUrl]);

  const handleDismissSaved = useCallback(() => {
    setSavedChangesDismissed(true);
  }, []);

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

  const changePrompt = `Apply these visual design changes to the codebase. Each change includes a CSS selector and, when available, the React/Vue/Svelte component name and source file. Use the component context to find the right file, then apply the property changes.`;

  const sendMenuActions = [
    {
      label: "Send to Claude Code",
      action: () => {
        const json = exportAsJSON(pageUrl, changes, undefined, componentMapRef.current);
        navigator.clipboard.writeText(`${changePrompt}\n\n${json}`);
        setSendMenuOpen(false);
      },
    },
    {
      label: "Send to Codex",
      action: () => {
        const json = exportAsJSON(pageUrl, changes, undefined, componentMapRef.current);
        navigator.clipboard.writeText(`${changePrompt}\n\n${json}`);
        chrome.tabs.create({ url: "https://chatgpt.com/codex" });
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
        navigator.clipboard.writeText(exportAsSummary(pageUrl, changes, undefined, componentMapRef.current));
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
              <path d="M3 7h6a4 4 0 0 1 0 8H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 4L3 7l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            className={`pd-panel__icon-btn ${!canRedo ? "pd-panel__icon-btn--disabled" : ""}`}
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13 7H7a4 4 0 0 0 0 8h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
            <ElementInfo data={elementData} multiEdit={multiEdit} onToggleMultiEdit={handleToggleMultiEdit} multiSelectCount={multiSelectCount} />
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
                  onRedo={handleRedo}
                  onRestore={handleLoadEdits}
                  url={pageUrl}
                />
              )}
            </div>
          </>
        ) : (
          <div className="pd-panel__empty">
            {hasSavedChanges && !savedChangesDismissed && (
              <div className="pd-panel__saved-prompt">
                <div className="pd-panel__saved-prompt-text">
                  Previously saved changes found. Would you like to reload them?
                </div>
                <div className="pd-panel__saved-prompt-actions">
                  <button
                    className="pd-panel__saved-prompt-btn pd-panel__saved-prompt-btn--primary"
                    onClick={handleLoadSaved}
                    type="button"
                  >
                    Load Saved Changes
                  </button>
                  <button
                    className="pd-panel__saved-prompt-btn"
                    onClick={handleDismissSaved}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            <div className="pd-panel__empty-icon">◇</div>
            <div className="pd-panel__empty-title">Select an element</div>
            <div className="pd-panel__empty-subtitle">
              Hover over the page and click an element to inspect and edit its
              properties
            </div>
            <div className="pd-panel__empty-hints">
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">Click</span>
                Select element
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">Double-click</span>
                Edit text
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">Shift+Click</span>
                Multi-select
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">Tab</span>
                Next sibling
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">Arrows</span>
                Nudge position
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">{navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Z</span>
                Undo
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">Delete</span>
                Remove element
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">{navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+H</span>
                Hide element
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">{navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+G</span>
                Add container
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">Esc</span>
                Deselect
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
