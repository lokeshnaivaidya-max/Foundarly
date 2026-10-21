// Browser-safe shim for Node.js process global in browser runtimes
const safeProcess = { env: {}, browser: true, version: "", platform: "browser", cwd: () => "" };
if (typeof window !== "undefined") {
  (window as any).process = (window as any).process || safeProcess;
}
if (typeof globalThis !== "undefined") {
  (globalThis as any).process = (globalThis as any).process || safeProcess;
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
