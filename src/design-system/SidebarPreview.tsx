/**
 * SidebarPreview — a fully static (no chrome API) mock of the full extension
 * sidebar, used in design-system.html so designers can select and tweak any
 * part of the panel UI.
 */
import { useState, useCallback } from "react";
import { DiamondIcon, UndoIcon, RedoIcon, LayersIcon } from "../panel/icons";
import { ElementInfo } from "../panel/components/ElementInfo";
import { DesignTab } from "../panel/components/DesignTab";
import { ChangesTab } from "../panel/components/ChangesTab";
import { AITab } from "../panel/components/AITab";
import { AgentSyncSection } from "../panel/components/AgentSyncSection";
import type { ElementData, Change } from "../shared/types";

type Tab = "design" | "changes" | "ai";

const MOCK_ELEMENT: ElementData = {
  selector: ".hero-card",
  tag: "div",
  id: "hero-card",
  classes: ["hero-card", "card", "card--primary"],
  rect: { x: 120, y: 240, width: 360, height: 200 },
  breadcrumb: "body > main > .hero-section > .hero-card",
  computedStyles: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: "12px",
    width: "360px",
    height: "200px",
    paddingTop: "16px",
    paddingRight: "16px",
    paddingBottom: "16px",
    paddingLeft: "16px",
    marginTop: "0px",
    marginRight: "0px",
    marginBottom: "0px",
    marginLeft: "0px",
    backgroundColor: "rgb(44, 44, 44)",
    borderRadius: "8px",
    borderTopWidth: "1px",
    borderRightWidth: "1px",
    borderBottomWidth: "1px",
    borderLeftWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: "rgb(62, 62, 62)",
    color: "rgb(224, 224, 224)",
    fontSize: "14px",
    fontWeight: "500",
    lineHeight: "1.4",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    opacity: "1",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    filter: "none",
    backdropFilter: "none",
    position: "relative",
  },
  authoredStyles: {
    padding: "16px",
    backgroundColor: "#2c2c2c",
    borderRadius: "8px",
    border: "1px solid #3e3e3e",
    gap: "12px",
  },
  hasTextContent: true,
  isImage: false,
  isFlex: true,
  isGrid: false,
  outerHTML: '<div class="hero-card card card--primary" id="hero-card">...</div>',
  matchCount: 2,
  designTokens: [
    { name: "--pd-bg-raised", value: "#2c2c2c" },
    { name: "--pd-border", value: "#3e3e3e" },
    { name: "--pd-radius-lg", value: "8px" },
  ],
  pageColors: ["#2c2c2c", "#3e3e3e", "#4f9eff", "#e0e0e0", "#ff453a", "#a78bfa"],
  pageValues: {
    spacing: [4, 8, 12, 16, 24, 32],
    radius: [4, 6, 8],
    strokeWidth: [1, 2],
  },
  componentInfo: {
    framework: "react",
    componentName: "HeroCard",
    componentHierarchy: ["App", "HeroSection", "HeroCard"],
    sourceFile: "src/components/HeroCard.tsx",
    sourceLine: 12,
    props: [],
  },
};

const MOCK_CHANGES: Change[] = [
  {
    id: "c1",
    timestamp: Date.now() - 30_000,
    selector: ".hero-card",
    description: "background-color: #2c2c2c → #1a1a2e",
    type: "style",
    property: "backgroundColor",
    from: "#2c2c2c",
    to: "#1a1a2e",
  },
  {
    id: "c2",
    timestamp: Date.now() - 65_000,
    selector: ".hero-card",
    description: "border-radius: 8px → 12px",
    type: "style",
    property: "borderRadius",
    from: "8px",
    to: "12px",
  },
  {
    id: "c3",
    timestamp: Date.now() - 120_000,
    selector: ".hero-section h1",
    description: "font-size: 24px → 32px",
    type: "style",
    property: "fontSize",
    from: "24px",
    to: "32px",
  },
];

/** Sidebar with an element selected and edit mode on */
export function SidebarSelected() {
  const [editMode, setEditMode] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("design");
  const [changes, setChanges] = useState<Change[]>(MOCK_CHANGES);
  const [layersPaneEnabled, setLayersPaneEnabled] = useState(false);
  const [multiEdit, setMultiEdit] = useState(false);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);

  const noop = useCallback(() => {}, []);
  const handleUndo = useCallback(
    (id: string) => setChanges((prev) => prev.filter((c) => c.id !== id)),
    [],
  );
  const handleUndoAll = useCallback(() => setChanges([]), []);

  return (
    <div className="pd-panel" style={{ height: "700px", width: "320px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header className="pd-panel__header">
        <div className="pd-panel__header-left">
          <button
            className={`pd-panel__toggle ${editMode ? "pd-panel__toggle--on" : ""}`}
            onClick={() => setEditMode((v) => !v)}
            title={editMode ? "Disable edit mode" : "Enable edit mode"}
          >
            <span className="pd-panel__toggle-track">
              <span className="pd-panel__toggle-thumb" />
            </span>
          </button>
          <button className="pd-panel__icon-btn" title="Undo">
            <UndoIcon size={16} />
          </button>
          <button className="pd-panel__icon-btn pd-panel__icon-btn--disabled" title="Redo" disabled>
            <RedoIcon size={16} />
          </button>
          <button
            className={`pd-panel__icon-btn ${layersPaneEnabled ? "pd-panel__icon-btn--active" : ""}`}
            onClick={() => setLayersPaneEnabled((v) => !v)}
            title="Toggle Layers pane"
          >
            <LayersIcon size={16} />
          </button>
        </div>
        <div className="pd-panel__header-right">
          <div className="pd-panel__send-wrap">
            <button
              className="pd-panel__send-btn"
              type="button"
              onClick={() => setSendMenuOpen((v) => !v)}
            >
              Send Changes
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {sendMenuOpen && (
              <div className="pd-panel__send-menu">
                <button className="pd-panel__send-menu-item" onClick={() => setSendMenuOpen(false)}>Copy Change Instructions</button>
                <button className="pd-panel__send-menu-item" onClick={() => setSendMenuOpen(false)}>Copy Screenshot</button>
                <button className="pd-panel__send-menu-item" onClick={() => setSendMenuOpen(false)}>Save Screenshot</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="pd-panel__body">
        <ElementInfo
          data={MOCK_ELEMENT}
          multiEdit={multiEdit}
          onToggleMultiEdit={() => setMultiEdit((v) => !v)}
          multiSelectCount={0}
        />
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
            className={`pd-panel__tab ${activeTab === "ai" ? "pd-panel__tab--active" : ""}`}
            onClick={() => setActiveTab("ai")}
          >
            AI
          </button>
        </div>
        <div className="pd-panel__content">
          {activeTab === "design" && (
            <DesignTab data={MOCK_ELEMENT} onStyleChange={noop} />
          )}
          {activeTab === "changes" && (
            <ChangesTab
              changes={changes}
              archivedSends={[]}
              onUndo={handleUndo}
              onUndoAll={handleUndoAll}
              url="https://example.com"
            />
          )}
          {activeTab === "ai" && (
            <AITab
              elementData={MOCK_ELEMENT}
              critiqueResponse={null}
              nlEditResponse={null}
              aiError={null}
              onClearCritique={noop}
              onClearNLEdit={noop}
              onClearError={noop}
            />
          )}
        </div>
      </div>

      <AgentSyncSection
        syncStatus={{
          enabled: false,
          status: "disconnected",
          endpoint: "http://localhost:3055",
          userId: "user-abc123",
        }}
      />
    </div>
  );
}

/** Sidebar in the empty/idle state (no element selected) */
export function SidebarEmpty() {
  const [editMode, setEditMode] = useState(false);

  return (
    <div className="pd-panel" style={{ height: "700px", width: "320px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header className="pd-panel__header">
        <div className="pd-panel__header-left">
          <button
            className={`pd-panel__toggle ${editMode ? "pd-panel__toggle--on" : ""}`}
            onClick={() => setEditMode((v) => !v)}
            title={editMode ? "Disable edit mode" : "Enable edit mode"}
          >
            <span className="pd-panel__toggle-track">
              <span className="pd-panel__toggle-thumb" />
            </span>
          </button>
          <button className="pd-panel__icon-btn pd-panel__icon-btn--disabled" title="Undo" disabled>
            <UndoIcon size={16} />
          </button>
          <button className="pd-panel__icon-btn pd-panel__icon-btn--disabled" title="Redo" disabled>
            <RedoIcon size={16} />
          </button>
          <button className="pd-panel__icon-btn" title="Layers pane">
            <LayersIcon size={16} />
          </button>
        </div>
        <div className="pd-panel__header-right">
          <div className="pd-panel__send-wrap">
            <button className="pd-panel__send-btn pd-panel__send-btn--disabled" type="button" disabled>
              Send Changes
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="pd-panel__body">
        <div className="pd-panel__empty">
          <div className="pd-panel__empty-icon">
            <DiamondIcon size={36} />
          </div>
          <div className="pd-panel__empty-title">Select an element</div>
          <div className="pd-panel__empty-subtitle">
            Hover over the page and click an element to inspect and edit its properties
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
              <span className="pd-panel__empty-hint-key">Cmd+Z</span>
              Undo
            </div>
            <div className="pd-panel__empty-hint">
              <span className="pd-panel__empty-hint-key">Delete</span>
              Remove element
            </div>
            <div className="pd-panel__empty-hint">
              <span className="pd-panel__empty-hint-key">Esc</span>
              Deselect
            </div>
          </div>
        </div>
      </div>

      <AgentSyncSection
        syncStatus={{
          enabled: false,
          status: "disconnected",
          endpoint: "http://localhost:3055",
          userId: "user-abc123",
        }}
      />
    </div>
  );
}
