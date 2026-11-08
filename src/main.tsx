import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "@tabler/icons-webfont/dist/tabler-icons-filled.min.css";
import "./styles.css";
import "./aximach-ui.css";

type StartupBoundaryState = { error: Error | null };

class StartupErrorBoundary extends React.Component<
  { children: React.ReactNode },
  StartupBoundaryState
> {
  state: StartupBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StartupBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("AXIMACH renderer startup error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const detail = this.state.error.stack || this.state.error.message || String(this.state.error);
      return (
        <main data-aximach-startup-error="true" role="alert" style={{
          minHeight: "100vh", boxSizing: "border-box", padding: "48px 24px",
          background: "#0b1626", color: "#e8f2ff", fontFamily: "Segoe UI, Arial, sans-serif",
        }}>
          <h1 style={{ margin: "0 0 12px", fontSize: 26 }}>AXIMACH could not start</h1>
          <p style={{ maxWidth: 900, color: "#b9cbe0" }}>
            A renderer error stopped the workspace from loading. Send this error to support.
          </p>
          <pre style={{
            maxWidth: 1100, padding: 16, overflow: "auto", whiteSpace: "pre-wrap",
            overflowWrap: "anywhere", border: "1px solid rgba(140,180,220,.25)",
            borderRadius: 10, background: "#101f33", color: "#ffd5a6",
          }}>{detail}</pre>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  document.body.textContent = "AXIMACH startup failed: root element was not found.";
  throw new Error("AXIMACH root element was not found.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <StartupErrorBoundary><App /></StartupErrorBoundary>
  </React.StrictMode>,
);
