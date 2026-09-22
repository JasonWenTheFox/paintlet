import React from "react";
import ReactDOM from "react-dom/client";
import { useEffect, useState } from "react";
import { AboutWindow } from "./components/AboutWindow";
import { applyTheme } from "./lib/theme";
import { loadSettings } from "./state/settings";
import { resolveLocale } from "./i18n";
import "./styles/index.css";

// Entry point for the About window's webview (about.html).
//
// Deliberately separate from main.tsx: a second entry keeps the whole editor —
// App, CanvasEngine, the tool registry — out of this window's bundle. Booting
// main.tsx here would allocate a full set of canvases for a panel that shows a
// logo and a version string.
//
// Theme comes from localStorage rather than IPC. Both windows are the same
// origin, so they share the storage area, which means no event contract to keep
// in sync. Applied before render so there's no flash of light-mode chrome.
const initialSettings = loadSettings();
applyTheme(initialSettings.theme);

// Follow the setting if the user changes it in Settings while this window is
// open. The `storage` event fires in same-origin documents other than the one
// that wrote, which covers exactly this case. Best-effort: if the webview
// doesn't deliver it, the theme is still correct on next open.
function AboutRoot() {
  const [settings, setSettings] = useState(initialSettings);
  const locale = resolveLocale(settings.language);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const update = () => {
      const next = loadSettings();
      applyTheme(next.theme);
      setSettings(next);
    };
    window.addEventListener("storage", update);
    window.addEventListener("languagechange", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("languagechange", update);
    };
  }, []);

  return <AboutWindow locale={locale} />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AboutRoot />
  </React.StrictMode>,
);
