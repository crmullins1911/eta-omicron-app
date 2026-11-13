import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Android/Chrome fires this once, often before the member has signed in,
// so catch it here and hand it to the in-app "Install" button later.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__eoInstallPrompt = e;
  window.dispatchEvent(new Event("eo-install-ready"));
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Keep the installed app (home screen icon) up to date without
// needing a manual delete-and-reinstall. Two parts:
// 1. When the new service worker actually takes control, reload once
//    so the page picks up the new code (paired with skipWaiting() +
//    clientsClaim() in sw.js, which make that happen quickly).
// 2. Actively ask for an update check whenever the app is reopened —
//    iOS in particular doesn't always check on its own reliably for
//    an installed PWA.
if ("serviceWorker" in navigator) {
  let hasReloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hasReloaded) return;
    hasReloaded = true;
    window.location.reload();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      navigator.serviceWorker.getRegistration().then((reg) => reg && reg.update());
    }
  });
}
