import { useState } from "react";
import { useElementData } from "./hooks/useElementData";
import { useStyleChange } from "./hooks/useStyleChange";
import { ElementInfo } from "./components/ElementInfo";
import { DesignTab } from "./components/DesignTab";
import { TypographyTab } from "./components/TypographyTab";

type Tab = "design" | "typography" | "changes";

export function App() {
  const { elementData, isConnected } = useElementData();
  const sendStyleChange = useStyleChange();
  const [activeTab, setActiveTab] = useState<Tab>("design");

  return (
    <div className="pd-panel">
      <header className="pd-panel__header">
        <div className="pd-panel__logo">
          <span className="pd-panel__logo-icon">◆</span>
          Page Designer
        </div>
        <span
          className={`pd-panel__status ${isConnected ? "pd-panel__status--active" : ""}`}
        >
          {isConnected ? "Active" : "Inactive"}
        </span>
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
                Typography
              </button>
              <button
                className={`pd-panel__tab ${activeTab === "changes" ? "pd-panel__tab--active" : ""}`}
                disabled
              >
                Changes
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
