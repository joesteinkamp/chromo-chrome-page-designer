import { useState, useCallback, useEffect, useRef } from "react";
import { DiamondIcon, UndoIcon, RedoIcon, LayersIcon, ResponsiveIcon } from "./icons";
import { useElementData } from "./hooks/useElementData";
import { useStyleChange } from "./hooks/useStyleChange";
import { ElementInfo } from "./components/ElementInfo";
import { DesignTab } from "./components/DesignTab";
import { ChangesTab } from "./components/ChangesTab";
import { AITab } from "./components/AITab";
import { TokensTab } from "./components/TokensTab";
import { AgentSyncSection, type AgentSyncStatus } from "./components/AgentSyncSection";
import { exportAsSummary, type ComponentContext } from "../shared/export";
import type { Change } from "../shared/types";
import type { Message, AISuggestion } from "../shared/messages";

type Tab = "design" | "changes" | "tokens" | "ai";

/** Viewport presets for responsive editing (CSS px) */
const VIEWPORT_PRESETS = [
  { label: "Mobile", width: 375 },
  { label: "Tablet", width: 768 },
  { label: "Laptop", width: 1280 },
] as const;

export interface ArchivedSend {
  id: string;
  timestamp: number;
  changes: Change[];
}

export function App() {
  const { elementData, isConnected, setElementData, multiSelectCount } = useElementData();
  const sendStyleChange = useStyleChange();
  const sendRemoveAutoLayout = useCallback(() => {
    chrome.runtime.sendMessage({ type: "REMOVE_AUTO_LAYOUT" } satisfies Message);
  }, []);
  const [activeTab, setActiveTab] = useState<Tab>("design");
  const [changes, setChanges] = useState<Change[]>([]);
  const [archivedSends, setArchivedSends] = useState<ArchivedSend[]>([]);
  const [canRedo, setCanRedo] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const [editMode, setEditMode] = useState(true);
  const editModeRef = useRef(true);
  const [multiEdit, setMultiEdit] = useState(false);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const sendMenuRef = useRef<HTMLDivElement>(null);
  const [hasSavedChanges, setHasSavedChanges] = useState(false);
  const [savedChangesDismissed, setSavedChangesDismissed] = useState(false);
  const [injectionFailed, setInjectionFailed] = useState(false);
  const componentMapRef = useRef(new Map<string, ComponentContext>());
  const [agentSyncStatus, setAgentSyncStatus] = useState<AgentSyncStatus>({
    enabled: false,
    status: "disconnected",
    endpoint: "",
    userId: "",
  });
  const [critiqueResponse, setCritiqueResponse] = useState<AISuggestion[] | null>(null);
  const [nlEditResponse, setNlEditResponse] = useState<Array<{ property: string; value: string }> | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [layersPaneEnabled, setLayersPaneEnabled] = useState(false);
  const [activeViewport, setActiveViewport] = useState<number | null>(null);
  const [actualViewport, setActualViewport] = useState<number | null>(null);
  const [responsiveBarOpen, setResponsiveBarOpen] = useState(false);

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
    editModeRef.current = next;
    if (!next) {
      setMultiEdit(false);
    }
    if (next) {
      setInjectionFailed(false);
    }
    chrome.runtime.sendMessage({
      type: next ? "ACTIVATE" : "DEACTIVATE",
    } satisfies Message);
  }, [editMode]);

  const handleToggleLayersPane = useCallback(() => {
    const next = !layersPaneEnabled;
    setLayersPaneEnabled(next);
    chrome.runtime.sendMessage({
      type: "TOGGLE_LAYERS_PANE",
      enabled: next,
    } satisfies Message);
  }, [layersPaneEnabled]);

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
        case "INJECTION_FAILED":
          setInjectionFailed(true);
          setEditMode(false);
          editModeRef.current = false;
          break;
        case "STATE_RESPONSE":
          if (message.isActive) {
            setInjectionFailed(false);
            // Re-apply the layers-pane preference on (re)activation — covers
            // navigation to a new page where the content script was freshly
            // injected and has no local state yet.
            chrome.storage.local.get("layersPaneEnabled").then((result) => {
              if (result.layersPaneEnabled) {
                chrome.runtime.sendMessage({
                  type: "TOGGLE_LAYERS_PANE",
                  enabled: true,
                } satisfies Message).catch(() => {});
              }
            }).catch(() => {});
          }
          break;
        case "AGENT_SYNC_STATUS":
          setAgentSyncStatus({
            enabled: message.enabled,
            status: message.status,
            endpoint: message.endpoint,
            userId: message.userId,
          });
          break;
        case "AI_CRITIQUE_RESPONSE":
          setCritiqueResponse(message.suggestions);
          break;
        case "AI_NL_EDIT_RESPONSE":
          setNlEditResponse(message.changes);
          break;
        case "AI_ERROR":
          setAiError(message.error);
          break;
        case "LAYERS_PANE_STATE":
          setLayersPaneEnabled(message.enabled);
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
    chrome.runtime.sendMessage({ type: "GET_AGENT_SYNC_STATUS" } satisfies Message);

    // Restore the layers-pane preference. If it was enabled previously, push
    // it to the content script so the pane re-mounts on this page.
    chrome.storage.local.get("layersPaneEnabled").then((result) => {
      const enabled = Boolean(result.layersPaneEnabled);
      setLayersPaneEnabled(enabled);
      if (enabled) {
        chrome.runtime.sendMessage({
          type: "TOGGLE_LAYERS_PANE",
          enabled: true,
        } satisfies Message).catch(() => {});
      }
    }).catch(() => {});

    // When the user switches tabs, reset to inactive
    const onTabActivated = () => {
      setEditMode(false);
      editModeRef.current = false;
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

    // When the active tab navigates/reloads, clear changes and re-activate
    const onTabUpdated = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id !== tabId) return;

        if (changeInfo.status === "loading") {
          // Page is reloading — clear changes and selection
          setChanges([]);
          setCanRedo(false);
          setElementData(null);
          if (tabs[0].url) setPageUrl(tabs[0].url);
        }

        if (changeInfo.status === "complete" && editModeRef.current) {
          // Page finished loading — re-activate if edit mode is on
          chrome.runtime.sendMessage({ type: "ACTIVATE" } satisfies Message).catch(() => {});
        }
      });
    };
    chrome.tabs.onUpdated.addListener(onTabUpdated);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      chrome.tabs.onActivated.removeListener(onTabActivated);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
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

  // --- Viewport presets ---

  const handleViewportPreset = useCallback(async (width: number | null) => {
    setActiveViewport(width);
    try {
      const resp: any = await chrome.runtime.sendMessage({
        type: "VIEWPORT_RESIZE",
        width,
      } satisfies Message);
      setActualViewport(width === null ? null : resp?.viewportWidth ?? null);
    } catch {
      setActualViewport(null);
    }
  }, []);

  // --- Screenshot ---

  const handleScreenshot = useCallback(async () => {
    try {
      const response: any = await chrome.runtime.sendMessage(
        { type: "CAPTURE_SCREENSHOT" } satisfies Message
      );
      if (response?.dataUrl) {
        const link = document.createElement("a");
        link.href = response.dataUrl;
        link.download = `chromo-design-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (e) {
      console.error("Screenshot failed:", e);
    }
  }, []);

  const handleCopyScreenshot = useCallback(async () => {
    try {
      const response: any = await chrome.runtime.sendMessage(
        { type: "CAPTURE_SCREENSHOT" } satisfies Message
      );
      if (response?.dataUrl) {
        const res = await fetch(response.dataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
      }
    } catch (e) {
      console.error("Copy screenshot failed:", e);
    }
  }, []);

  // --- Send menu actions ---

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  /**
   * Download the before/after screenshot pair: "before" was captured when
   * edit mode was activated on this page, "after" is captured now. Returns a
   * note for the copied prompt listing the files (empty when capture fails).
   */
  const downloadBeforeAfterShots = async (): Promise<string> => {
    try {
      const ts = Date.now();
      const [beforeResp, afterResp]: any[] = await Promise.all([
        chrome.runtime.sendMessage({ type: "GET_BEFORE_SCREENSHOT" } satisfies Message),
        chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" } satisfies Message),
      ]);
      const files: string[] = [];
      if (beforeResp?.dataUrl) {
        const name = `chromo-before-${ts}.jpg`;
        downloadDataUrl(beforeResp.dataUrl, name);
        files.push(name);
      }
      if (afterResp?.dataUrl) {
        const name = `chromo-after-${ts}.png`;
        downloadDataUrl(afterResp.dataUrl, name);
        files.push(name);
      }
      if (files.length === 2) {
        return `\n\nBefore/after screenshots of the page were downloaded (${files.join(", ")}). Attach both images to this request — "before" is the page when editing started, "after" shows the desired result.`;
      }
      if (files.length === 1) {
        return `\n\nA screenshot of the page's desired final state was downloaded (${files[0]}). Attach it to this request for visual context.`;
      }
    } catch { /* screenshots are optional context */ }
    return "";
  };

  const sendMenuActions = [
    {
      label: "Copy Change Instructions",
      action: async () => {
        const summary = exportAsSummary(pageUrl, changes, undefined, componentMapRef.current);
        const hasComments = changes.some((c) => c.type === "comment");
        const basePrompt = `Apply these visual design changes to the codebase. Each change includes a CSS selector and, when available, the React/Vue/Svelte component name and source file. Use the component context to find the right file, then apply the property changes. When a change includes a Tailwind hint (e.g. replace \`p-4\` with \`p-6\`), edit the utility classes instead of writing raw CSS. When a change notes that a value matches a design token, use the var() reference instead of a hardcoded value. Entries marked "prop" are component prop edits — change the prop at the usage site in source code. Changes annotated with a viewport width were made at that responsive size — scope them with the matching media query or responsive utility variant (e.g. Tailwind \`max-md:\`) instead of applying them at all sizes.`;
        const commentPrompt = `\n\nEntries marked "Comment # (designer intent)" are freeform instructions from the designer about changes that couldn't be expressed as style edits (e.g. "use a dropdown instead of buttons", "swap this for the Button component"). Treat comments as higher-priority than style diffs when they conflict, and use judgment to implement the requested change — which may involve swapping components, changing behavior, or restructuring markup rather than just adjusting CSS.`;
        const prompt = hasComments ? `${basePrompt}${commentPrompt}` : basePrompt;
        const shotNote = await downloadBeforeAfterShots();
        navigator.clipboard.writeText(`${prompt}\n\n${summary}${shotNote}`);
        if (changes.length > 0) {
          setArchivedSends((prev) => [
            { id: `send-${Date.now()}`, timestamp: Date.now(), changes: [...changes] },
            ...prev,
          ]);
          chrome.runtime.sendMessage({ type: "CLEAR_CHANGES" } satisfies Message);
        }
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
            <UndoIcon size={16} />
          </button>
          <button
            className={`pd-panel__icon-btn ${!canRedo ? "pd-panel__icon-btn--disabled" : ""}`}
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo"
          >
            <RedoIcon size={16} />
          </button>
          <button
            className={`pd-panel__icon-btn ${layersPaneEnabled ? "pd-panel__icon-btn--active" : ""}`}
            onClick={handleToggleLayersPane}
            title={layersPaneEnabled ? "Hide Layers pane" : "Show Layers pane (on-page hierarchy)"}
            aria-pressed={layersPaneEnabled}
          >
            <LayersIcon size={16} />
          </button>
          <button
            className={`pd-panel__icon-btn ${responsiveBarOpen ? "pd-panel__icon-btn--active" : ""}`}
            onClick={() => setResponsiveBarOpen((open) => !open)}
            title={responsiveBarOpen ? "Hide responsive options" : "Show responsive options (viewport presets)"}
            aria-pressed={responsiveBarOpen}
          >
            <ResponsiveIcon size={16} />
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

      {responsiveBarOpen && (
      <div className="pd-panel__viewport-bar">
        {VIEWPORT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            className={`pd-panel__viewport-btn ${activeViewport === preset.width ? "pd-panel__viewport-btn--active" : ""}`}
            onClick={() => handleViewportPreset(preset.width)}
            title={`Resize page viewport to ${preset.width}px — changes made here export with a breakpoint note`}
            type="button"
          >
            {preset.label}
          </button>
        ))}
        <button
          className={`pd-panel__viewport-btn ${activeViewport === null ? "pd-panel__viewport-btn--active" : ""}`}
          onClick={() => handleViewportPreset(null)}
          title="Restore original window size"
          type="button"
        >
          Full
        </button>
        {activeViewport !== null && actualViewport !== null && (
          <span className="pd-panel__viewport-readout">{actualViewport}px</span>
        )}
      </div>
      )}

      <div className="pd-panel__body">
        {elementData || changes.length > 0 || activeTab === "tokens" ? (
          <>
            {elementData && (
              <ElementInfo data={elementData} multiEdit={multiEdit} onToggleMultiEdit={handleToggleMultiEdit} multiSelectCount={multiSelectCount} />
            )}
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
              <button
                className={`pd-panel__tab ${activeTab === "tokens" ? "pd-panel__tab--active" : ""}`}
                onClick={() => setActiveTab("tokens")}
              >
                Tokens
              </button>
              <button
                className={`pd-panel__tab ${activeTab === "ai" ? "pd-panel__tab--active" : ""}`}
                onClick={() => setActiveTab("ai")}
              >
                AI
              </button>
            </div>
            <div className="pd-panel__content">
              {activeTab === "design" && (
                elementData ? (
                  <DesignTab
                    data={elementData}
                    onStyleChange={sendStyleChange}
                    onRemoveLayout={sendRemoveAutoLayout}
                  />
                ) : (
                  <div className="pd-panel__tab-empty">
                    Select an element to edit its properties
                  </div>
                )
              )}
              {activeTab === "changes" && (
                <ChangesTab
                  changes={changes}
                  archivedSends={archivedSends}
                  onUndo={handleUndo}
                  onUndoAll={handleUndoAll}
                  url={pageUrl}
                />
              )}
              {activeTab === "tokens" && <TokensTab />}
              {activeTab === "ai" && (
                elementData ? (
                  <AITab
                    elementData={elementData}
                    critiqueResponse={critiqueResponse}
                    nlEditResponse={nlEditResponse}
                    aiError={aiError}
                    onClearCritique={() => setCritiqueResponse(null)}
                    onClearNLEdit={() => setNlEditResponse(null)}
                    onClearError={() => setAiError(null)}
                  />
                ) : (
                  <div className="pd-panel__tab-empty">
                    Select an element to use AI features
                  </div>
                )
              )}
            </div>
          </>
        ) : (
          <div className="pd-panel__empty">
            {injectionFailed && (
              <div className="pd-panel__injection-banner">
                <div className="pd-panel__injection-banner-text">
                  Cannot access this page. Click the extension icon in the toolbar to grant access, then toggle edit mode on.
                </div>
              </div>
            )}
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
            <div className="pd-panel__empty-icon"><DiamondIcon size={36} /></div>
            <button
              className="pd-panel__tokens-link"
              onClick={() => setActiveTab("tokens")}
              type="button"
            >
              Edit design tokens →
            </button>
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
                Drill in / edit text
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">{navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Click</span>
                Select deepest
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">Shift+Click</span>
                Multi-select
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">Shift+Enter</span>
                Select parent
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">Tab</span>
                Next sibling
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">{navigator.platform.includes("Mac") ? "Opt" : "Alt"}+Hover</span>
                Measure distance
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">{navigator.platform.includes("Mac") ? "Opt" : "Alt"}+Drag</span>
                Drag a copy
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">{navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+C/V</span>
                Copy / paste element
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">{navigator.platform.includes("Mac") ? "Cmd+Opt" : "Ctrl+Alt"}+C/V</span>
                Copy / paste style
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
                <span className="pd-panel__empty-hint-key">{navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+D</span>
                Duplicate
              </div>
              <div className="pd-panel__empty-hint">
                <span className="pd-panel__empty-hint-key">Esc</span>
                Select parent
              </div>
            </div>
          </div>
        )}
      </div>
      <AgentSyncSection syncStatus={agentSyncStatus} />
    </div>
  );
}
