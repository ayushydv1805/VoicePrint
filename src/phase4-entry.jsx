import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppCloud from "./AppCloud";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppCloud />
  </StrictMode>
);
