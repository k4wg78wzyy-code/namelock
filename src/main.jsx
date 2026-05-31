import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Global resets so the app fills the device screen edge-to-edge.
const globalCss = document.createElement("style");
globalCss.textContent = `
  * { -webkit-tap-highlight-color: transparent; }
  html, body, #root { margin: 0; padding: 0; min-height: 100%; background: #0f0c09; }
  body { overscroll-behavior-y: none; }
`;
document.head.appendChild(globalCss);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
