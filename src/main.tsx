import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "@tabler/icons-webfont/dist/tabler-icons-filled.min.css";
import "./styles.css";
import "./aximach-ui.css";
import "./aximach-ui-enhancements.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
