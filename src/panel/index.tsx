import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import { App } from "./App";
import "./panel.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: "#ff6b6b", fontFamily: "monospace", fontSize: 12 }}>
          <h3 style={{ marginBottom: 8 }}>Design in Chrome Error</h3>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById("root")!;
createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
