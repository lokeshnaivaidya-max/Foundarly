// Browser-safe shim for Node.js process global in browser runtimes
if (typeof window !== "undefined" && typeof (window as any).process === "undefined") {
  (window as any).process = { env: {}, browser: true, version: "" };
}

import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { suppressThirdPartyLogs } from "./utils/suppressLogs";

// Suppress noisy third-party console logs in development
suppressThirdPartyLogs();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
