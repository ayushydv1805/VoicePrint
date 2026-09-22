import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Phase6App from "./Phase6App";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Phase6App />
  </StrictMode>
);
