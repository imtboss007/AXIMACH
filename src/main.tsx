import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "@tabler/icons-webfont/dist/tabler-icons-filled.min.css";
import "./aximach-premium.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
