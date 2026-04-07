import { useState, useEffect, useCallback } from "react";
import type { Message } from "../../shared/messages";
import "./agent-sync.css";

export interface AgentSyncStatus {
  enabled: boolean;
  status: "connected" | "disconnected" | "connecting";
  endpoint: string;
  userId: string;
}

interface AgentSyncSectionProps {
  syncStatus: AgentSyncStatus;
}

export function AgentSyncSection({ syncStatus }: AgentSyncSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleToggle = useCallback(() => {
    const msg: Message = syncStatus.enabled
      ? { type: "AGENT_SYNC_DISABLE" }
      : { type: "AGENT_SYNC_ENABLE" };
    chrome.runtime.sendMessage(msg);
  }, [syncStatus.enabled]);

  const handleCopyConfig = useCallback(async () => {
    const command = `claude mcp add --transport http chromo-designer ${syncStatus.endpoint}`;
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [syncStatus.endpoint]);

  const statusDotClass =
    syncStatus.status === "connected"
      ? "pd-agent-sync__status-dot--connected"
      : syncStatus.status === "connecting"
        ? "pd-agent-sync__status-dot--connecting"
        : "pd-agent-sync__status-dot--disconnected";

  return (
    <div className="pd-agent-sync">
      <div className="pd-agent-sync__header">
        <span className="pd-agent-sync__label">Agent Sync</span>
        <button
          className={`pd-agent-sync__toggle ${syncStatus.enabled ? "pd-agent-sync__toggle--on" : ""}`}
          onClick={handleToggle}
          title={syncStatus.enabled ? "Disable agent sync" : "Enable agent sync"}
        >
          <span className="pd-agent-sync__toggle-track">
            <span className="pd-agent-sync__toggle-thumb" />
          </span>
        </button>
      </div>

      {syncStatus.enabled ? (
        <div className="pd-agent-sync__details">
          <div className="pd-agent-sync__status">
            <span className={`pd-agent-sync__status-dot ${statusDotClass}`} />
            <span className="pd-agent-sync__status-text">
              {syncStatus.status === "connected"
                ? "Connected"
                : syncStatus.status === "connecting"
                  ? "Connecting..."
                  : "Disconnected"}
            </span>
          </div>

          <div className="pd-agent-sync__endpoint">
            {syncStatus.endpoint}
          </div>

          <button
            className="pd-agent-sync__copy-btn"
            onClick={handleCopyConfig}
          >
            {copied ? "Copied!" : "Copy MCP Config"}
          </button>

          <div className="pd-agent-sync__note">
            Run this command once in your terminal to connect Claude Code
          </div>
        </div>
      ) : (
        <div className="pd-agent-sync__description">
          Connect to AI coding agents via MCP
        </div>
      )}
    </div>
  );
}
