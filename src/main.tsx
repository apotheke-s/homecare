import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

const updateServiceWorker = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new Event("pwa-update-available"));
  },
  onOfflineReady() {
    window.dispatchEvent(new Event("pwa-offline-ready"));
  }
});

window.updateHomecareServiceWorker = () => updateServiceWorker(true);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
