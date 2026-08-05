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
