import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Phase7App from "./Phase7App";
import ErrorBoundary from "./components/Phase7ErrorBoundary";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      registration.update().catch(() => {});
    }).catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <Phase7App />
    </ErrorBoundary>
  </StrictMode>
);
