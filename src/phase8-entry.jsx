import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Phase8App from "./Phase8App";
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
      <Phase8App />
    </ErrorBoundary>
  </StrictMode>
);
