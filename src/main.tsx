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
import { isChunkLoadError } from "./utils/lazyWithRetry";

// Suppress noisy third-party console logs in development
suppressThirdPartyLogs();

if (typeof window !== "undefined") {
  // Catch Vite module preload errors when new deployments change asset hashes
  window.addEventListener("vite:preloadError", (event: any) => {
    console.warn("[Vite] Caught vite:preloadError event:", event?.payload);
    try {
      const reloadKey = `foundarly_vite_preload_reload_${window.location.pathname}`;
      if (!window.sessionStorage.getItem(reloadKey)) {
        window.sessionStorage.setItem(reloadKey, "true");
        window.location.reload();
      }
    } catch {
      // ignore storage access errors
    }
  });

  // Global unhandledrejection listener for transient chunk load drops
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    if (isChunkLoadError(event.reason)) {
      console.warn("[Global] Intercepted transient chunk load error in promise rejection:", event.reason);
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
