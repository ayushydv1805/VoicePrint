import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppCloud from "./Phase4App";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppCloud />
  </StrictMode>
);
