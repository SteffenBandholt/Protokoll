// TECH-CONTRACT (verbindlich): docs/UI-TECH-CONTRACT.md
// CONTRACT-VERSION: 1.0.1
// src/renderer/main.js

import Router from "./app/Router.js";
import MainHeader from "./ui/MainHeader.js";
import { DEFAULT_THEME_SETTINGS, applyThemeForSettings } from "./theme/themes.js";
import { applyPopupButtonStyle, applyPopupCardStyle } from "./ui/popupButtonStyles.js";

document.addEventListener("DOMContentLoaded", async () => {
  const APP_VERSION = "1.0";
  const FEATURE_FLAG_KEY = "bbm.useNewCompanyWorkflow";
  const UI_MODE_KEY = "bbm.uiMode";
  const TRIAL_DAYS_KEY = "trial.daysLimit";
  const TRIAL_ENABLED_KEY = "trial.enabled";
  const TRIAL_FIRST_START_KEY = "trial.firstStartAt";
  const PRINT_V2_PAD_LEFT_KEY = "print.v2.pagePadLeftMm";
  const PRINT_V2_PAD_RIGHT_KEY = "print.v2.pagePadRightMm";
  const PRINT_V2_PAD_TOP_KEY = "print.v2.pagePadTopMm";
  const PRINT_V2_PAD_BOTTOM_KEY = "print.v2.pagePadBottomMm";
  const PRINT_V2_FOOTER_RESERVE_KEY = "print.v2.footerReserveMm";
  const PRINT_LAYOUT_DEFAULTS = {
    [PRINT_V2_PAD_LEFT_KEY]: "19",
    [PRINT_V2_PAD_RIGHT_KEY]: "15",
    [PRINT_V2_PAD_TOP_KEY]: "3",
    [PRINT_V2_PAD_BOTTOM_KEY]: "18",
    [PRINT_V2_FOOTER_RESERVE_KEY]: "12",
  };
  const WHATSNEW_KEY_PREFIX = "bbm_whatsnew_seen_";
  const toSeenKey = (version) => `${WHATSNEW_KEY_PREFIX}${String(version || "").trim() || "unknown"}`;
  const isSeenValue = (v) => {
    const s = String(v == null ? "" : v).trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "on";
  };

  const readWhatsNewSeen = async (version) => {
    const key = toSeenKey(version);
    try {
      const api = window.bbmDb || {};
      if (typeof api.appSettingsGetMany === "function") {
        const res = await api.appSettingsGetMany([key]);
        if (res?.ok) {
          const data = res.data || {};
          if (isSeenValue(data[key])) return true;
        }
      }
    } catch (_e) {
      // ignore and continue with localStorage fallback
    }

    try {
      return isSeenValue(window.localStorage?.getItem?.(key));
    } catch (_e) {
      return false;
    }
  };

  const writeWhatsNewSeen = async (version) => {
    const key = toSeenKey(version);
    try {
      const api = window.bbmDb || {};
      if (typeof api.appSettingsSetMany === "function") {
        const res = await api.appSettingsSetMany({ [key]: "1" });
        if (res?.ok) return;
      }
    } catch (_e) {
      // ignore and continue with localStorage fallback
    }

    try {
      window.localStorage?.setItem?.(key, "1");
    } catch (_e) {
      // ignore
    }
  };

  const readUseNewCompanyWorkflowFlag = () => {
    try {
      const raw = window.localStorage?.getItem?.(FEATURE_FLAG_KEY);
      const s = String(raw == null ? "" : raw).trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(s)) return true;
      if (["0", "false", "no", "off"].includes(s)) return false;
      return false;
    } catch (_e) {
      return false;
    }
  };

  const writeUseNewCompanyWorkflowFlag = (value) => {
    try {
      window.localStorage?.setItem?.(FEATURE_FLAG_KEY, value ? "true" : "false");
    } catch (_e) {
      // ignore
    }
  };

  const showStartupOverlay = ({ durationMs = 3000 } = {}) => {
    if (document.querySelector('[data-bbm-startup-overlay="true"]')) return;

    const overlay = document.createElement("div");
    overlay.setAttribute("data-bbm-startup-overlay", "true");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.background = "rgba(15,23,42,0.18)";
    overlay.style.zIndex = "11000";
    overlay.style.pointerEvents = "none";
    overlay.style.opacity = "1";
    overlay.style.transition = "opacity 260ms ease";

    const card = document.createElement("div");
    card.style.width = "75vw";
    card.style.height = "75vh";
    card.style.maxWidth = "1100px";
    card.style.maxHeight = "760px";
    card.style.minWidth = "360px";
    card.style.minHeight = "260px";
    card.style.borderRadius = "14px";
    card.style.background = "rgba(15,23,42,0.92)";
    card.style.boxShadow = "0 20px 50px rgba(0,0,0,0.35)";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.alignItems = "center";
    card.style.justifyContent = "center";
    card.style.gap = "14px";

    const img = document.createElement("img");
    img.src = "./assets/icon-BBM.png";
    img.alt = "BBM";
    img.style.width = "clamp(200px, 26vw, 360px)";
    img.style.height = "auto";
    img.style.objectFit = "contain";

    const text = document.createElement("div");
    text.textContent = "Initialisiere ...";
    text.style.color = "#e2e8f0";
    text.style.fontSize = "14px";
    text.style.fontWeight = "600";
    text.style.letterSpacing = "0.3px";

    card.append(img, text);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.style.opacity = "0";
      setTimeout(() => {
        if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
      }, 280);
    }, Math.max(500, Number(durationMs) || 3000));
  };

  const enforceTrialLimit = async () => {
    const api = window.bbmDb || {};
    if (typeof api.appSettingsGetMany !== "function") return true;

    let data = {};
    try {
      const res = await api.appSettingsGetMany([TRIAL_ENABLED_KEY, TRIAL_DAYS_KEY, TRIAL_FIRST_START_KEY]);
      if (!res?.ok) return true;
      data = res.data || {};
    } catch (_e) {
      return true;
    }

    const enabledRaw = String(data[TRIAL_ENABLED_KEY] || "").trim().toLowerCase();
    const enabled = enabledRaw === "1" || enabledRaw === "true" || enabledRaw === "yes" || enabledRaw === "on";
    const limit = Math.max(0, Math.floor(Number(data[TRIAL_DAYS_KEY] || 0) || 0));
    if (!enabled || limit <= 0) return true;

    let firstStart = Math.floor(Number(data[TRIAL_FIRST_START_KEY] || 0) || 0);
    if (!Number.isFinite(firstStart) || firstStart <= 0) {
      firstStart = Date.now();
      if (typeof api.appSettingsSetMany === "function") {
        try {
          await api.appSettingsSetMany({ [TRIAL_FIRST_START_KEY]: String(firstStart) });
        } catch (_e) {
          // ignore
        }
      }
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const usedDays = Math.floor((Date.now() - firstStart) / dayMs) + 1;
    const remainingDays = limit - usedDays;

    // Hinweis in den letzten 5 Tagen vor Ablauf
    if (remainingDays >= 0 && remainingDays <= 4) {
      const msg =
        remainingDays === 0
          ? "Hinweis: Die Testversion läuft heute ab."
          : `Hinweis: Die Testversion läuft in ${remainingDays + 1} Tagen ab.`;
      alert(msg);
    }

    if (usedDays <= limit) return true;

    alert(`Testversion abgelaufen (${limit} Nutzungstage).`);
    if (typeof api.appQuit === "function") {
      try {
        await api.appQuit();
        return false;
      } catch (_e) {
        // ignore
      }
    }
    try {
      window.close();
    } catch (_e) {
      // ignore
    }
    return false;
  };

  const ensureInitialPrintLayoutDefaults = async () => {
    const api = window.bbmDb || {};
    if (typeof api.appSettingsGetMany !== "function") return;
    if (typeof api.appSettingsSetMany !== "function") return;

    const keys = Object.keys(PRINT_LAYOUT_DEFAULTS);
    try {
      const res = await api.appSettingsGetMany(keys);
      if (!res?.ok) return;
      const data = res.data || {};
      const hasAnySavedValue = keys.some((key) => String(data[key] || "").trim() !== "");
      if (hasAnySavedValue) return;
      await api.appSettingsSetMany(PRINT_LAYOUT_DEFAULTS);
    } catch (_e) {
      // ignore
    }
  };

  const readUiMode = () => {
    try {
      window.localStorage?.setItem?.(UI_MODE_KEY, "new");
    } catch (_e) {
      // ignore
    }
    return "new";
  };

  // Manueller Test:
  // 1) Start Version X -> Overlay erscheint -> OK.
  // 2) Neustart Version X -> Overlay erscheint nicht mehr.
  // 3) APP_VERSION auf Y -> Overlay erscheint wieder.
  const maybeShowWhatsNew = async () => {
    try {
      if (await readWhatsNewSeen(APP_VERSION)) return;
      if (document.querySelector('[data-bbm-whatsnew-overlay="true"]')) return;

      const url = new URL("./help/worklog.de.txt", window.location.href);
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) return;

      const raw = await resp.text();
      const bodyText = String(raw || "").trim();
      if (!bodyText) return;

      const overlay = document.createElement("div");
      overlay.setAttribute("data-bbm-whatsnew-overlay", "true");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(0,0,0,0.35)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.zIndex = "12000";
      overlay.tabIndex = -1;

      const card = document.createElement("div");
      card.style.width = "min(640px, 92vw)";
      card.style.maxHeight = "80vh";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.background = "var(--card-bg)";
      card.style.borderRadius = "10px";
      card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
      applyPopupCardStyle(card);

      const head = document.createElement("div");
      head.style.padding = "14px 16px 10px 16px";
      head.style.borderBottom = "1px solid rgba(0,0,0,0.08)";

      const headMeta = document.createElement("div");
      headMeta.textContent = `BBM ${APP_VERSION}`;
      headMeta.style.fontSize = "12px";
      headMeta.style.opacity = "0.7";
      headMeta.style.marginBottom = "4px";

      const headTitle = document.createElement("div");
      headTitle.textContent = "Was ist neu/geändert";
      headTitle.style.fontWeight = "700";

      head.append(headMeta, headTitle);

      const content = document.createElement("div");
      content.style.padding = "12px 16px";
      content.style.overflow = "auto";
      content.style.flex = "1 1 auto";

      const body = document.createElement("div");
      body.style.whiteSpace = "pre-wrap";
      body.textContent = bodyText;
      content.appendChild(body);

      const footer = document.createElement("div");
      footer.style.display = "flex";
      footer.style.justifyContent = "flex-end";
      footer.style.gap = "8px";
      footer.style.padding = "10px 16px";
      footer.style.borderTop = "1px solid rgba(0,0,0,0.08)";
      footer.style.background = "rgba(255,255,255,0.98)";
      footer.style.borderBottomLeftRadius = "10px";
      footer.style.borderBottomRightRadius = "10px";

      const btnOk = document.createElement("button");
      btnOk.textContent = "OK";
      applyPopupButtonStyle(btnOk, { variant: "primary" });

      const close = () => {
        if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
      };
      const closeAndRemember = async () => {
        close();
        try {
          await writeWhatsNewSeen(APP_VERSION);
        } catch (_e) {
          // ignore
        }
      };

      btnOk.onclick = () => {
        closeAndRemember();
      };

      overlay.onclick = (e) => {
        if (e.target === overlay) closeAndRemember();
      };
      overlay.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        closeAndRemember();
      });

      footer.appendChild(btnOk);
      card.append(head, content, footer);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      try {
        overlay.focus();
      } catch (_e) {
        // ignore
      }
    } catch (_) {
      // still no popup if anything goes wrong
    }
  };

  const initUiOld = () => {
  const themeStyle = document.createElement("style");
  themeStyle.textContent = `
    :root {
      --header-bg: #D6ECFF;
      --header-text: #0F172A;
      --sidebar-bg: #0F172A;
      --sidebar-hover-bg: #172554;
      --sidebar-active-bg: #1D4ED8;
      --sidebar-active-indicator: #93C5FD;
      --sidebar-text: #E2E8F0;
      --main-bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --card-border: #E2E8F0;
      --text-main: #0F172A;
      --btn-radius: 8px;
      --btn-outline-color: #1565c0;
      --btn-outline-bg: #ffffff;
      --btn-outline-hover-bg: #f1f6ff;
      --btn-primary-bg: #1976d2;
      --btn-primary-text: #ffffff;
      --btn-danger-bg: #c62828;
      --btn-danger-text: #ffffff;
      --btn-warn-bg: #f59e0b;
      --btn-warn-text: #ffffff;
      --btn-focus-ring: rgba(25, 118, 210, 0.35);
    }
    button {
      padding: 6px 10px;
      border-radius: var(--btn-radius);
      border: 1px solid var(--btn-outline-color);
      background: var(--btn-outline-bg);
      color: var(--btn-outline-color);
      font-weight: 600;
      min-height: 30px;
      cursor: pointer;
      transition: background 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
    }
    button:hover:not(:disabled) {
      background: var(--btn-outline-hover-bg);
      box-shadow: 0 1px 0 rgba(0,0,0,0.08);
    }
    button:active:not(:disabled) {
      box-shadow: inset 0 1px 0 rgba(0,0,0,0.12);
    }
    button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--btn-focus-ring);
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    button[data-variant="primary"] {
      background: var(--btn-primary-bg);
      border-color: var(--btn-primary-bg);
      color: var(--btn-primary-text);
    }
    button[data-variant="primary"]:hover:not(:disabled) {
      filter: brightness(0.95);
    }
    button[data-variant="danger"] {
      background: var(--btn-danger-bg);
      border-color: var(--btn-danger-bg);
      color: var(--btn-danger-text);
    }
    button[data-variant="danger"]:hover:not(:disabled) {
      filter: brightness(0.95);
    }
    button[data-variant="warn"] {
      background: var(--btn-warn-bg);
      border-color: var(--btn-warn-bg);
      color: var(--btn-warn-text);
    }
    button[data-variant="warn"]:hover:not(:disabled) {
      filter: brightness(0.95);
    }
  `;
  document.head.appendChild(themeStyle);
  applyThemeForSettings(DEFAULT_THEME_SETTINGS);

  document.body.style.margin = "0";
  document.body.style.height = "100vh";
  document.body.style.background = "var(--main-bg)";
  document.body.style.color = "var(--text-main)";

  const host = document.getElementById("content");
  if (!host) {
    throw new Error("Root-Container #content nicht gefunden");
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== "Escape") return;

    const overlays = Array.from(document.querySelectorAll("div")).filter((el) => {
      if (!el || !el.style) return false;
      if (el.style.display === "none") return false;
      if (el.style.position !== "fixed") return false;
      const z = Number(el.style.zIndex || 0);
      return Number.isFinite(z) && z >= 9999;
    });

    if (!overlays.length) return;
    const top = overlays[overlays.length - 1];
    const buttons = Array.from(top.querySelectorAll("button"));
    if (!buttons.length) return;

    const isEscape = e.key === "Escape";
    const preferred = isEscape
      ? ["abbrechen", "schließen", "close", "cancel", "×", "✕"]
      : ["speichern", "löschen", "ok", "übernehmen", "zuordnen"];

    const findBtn = () => {
      for (const label of preferred) {
        const btn = buttons.find((b) =>
          (b.textContent || "").toLowerCase().includes(label)
        );
        if (btn) return btn;
      }
      return null;
    };

    const btn = findBtn();
    if (!btn || btn.disabled) return;

    e.preventDefault();
    btn.click();
  });

  host.innerHTML = "";
  host.style.height = "100vh";
  host.style.display = "flex";
  host.style.flexDirection = "column";
  host.style.alignItems = "stretch";
  host.style.boxSizing = "border-box";
  host.style.fontFamily = "Calibri, Arial, sans-serif";
  host.style.color = "var(--text-main)";
  host.style.background = "var(--main-bg)";

  const SIDEBAR_WIDTH = 190;
  const PAD = 12;

  const bodyRow = document.createElement("div");
  bodyRow.style.flex = "1";
  bodyRow.style.display = "flex";
  bodyRow.style.alignItems = "stretch";
  bodyRow.style.boxSizing = "border-box";
  bodyRow.style.overflow = "hidden";

  const sidebar = document.createElement("div");
  sidebar.setAttribute("data-bbm-sidebar", "true");
  sidebar.style.width = `${SIDEBAR_WIDTH}px`;
  sidebar.style.minWidth = `${SIDEBAR_WIDTH}px`;
  sidebar.style.maxWidth = `${SIDEBAR_WIDTH}px`;
  sidebar.style.flex = `0 0 ${SIDEBAR_WIDTH}px`;
  sidebar.style.borderRight = "1px solid #1e293b";
  sidebar.style.padding = `${PAD}px`;
  sidebar.style.boxSizing = "border-box";
  sidebar.style.display = "flex";
  sidebar.style.flexDirection = "column";
  sidebar.style.overflowY = "auto";
  sidebar.style.overflowX = "visible";
  sidebar.style.background = "var(--sidebar-bg)";
  sidebar.style.color = "var(--sidebar-text)";

  const content = document.createElement("div");
  content.style.flex = "1";
  content.style.padding = `${PAD}px`;
  content.style.boxSizing = "border-box";
  content.style.overflow = "auto";
  content.style.background = "var(--main-bg)";
  content.style.color = "var(--text-main)";

  bodyRow.append(sidebar, content);

  const topBox = document.createElement("div");
  topBox.style.width = "100%";
  topBox.style.boxSizing = "border-box";
  topBox.style.padding = "0";
  topBox.style.display = "flex";
  topBox.style.flexDirection = "column";
  topBox.style.gap = "8px";

  const bottomBox = document.createElement("div");
  bottomBox.style.width = "100%";
  bottomBox.style.boxSizing = "border-box";
  bottomBox.style.padding = "0";
  bottomBox.style.marginTop = "auto";
  bottomBox.style.display = "flex";
  bottomBox.style.flexDirection = "column";
  bottomBox.style.gap = "8px";

  sidebar.append(topBox, bottomBox);

  const buttonsByKey = new Map();

  const setActive = (key) => {
    for (const [k, btn] of buttonsByKey.entries()) {
      const active = k === key;
      btn.dataset.active = active ? "true" : "false";
      btn.style.background = active ? "var(--sidebar-active-bg)" : "transparent";
      btn.style.border = active
        ? "1px solid var(--sidebar-active-bg)"
        : "1px solid rgba(226, 232, 240, 0.28)";
      btn.style.boxShadow = "none";
      btn.style.color = "var(--sidebar-text)";
      btn.style.fontWeight = active ? "700" : "400";
    }
  };

  const router = new Router({
    contentRoot: content,
    onSectionChange: (section) => setActive(section),
  });
  router.featureFlags = {
    useNewCompanyWorkflow: readUseNewCompanyWorkflowFlag(),
  };
  try {
    window.__bbmFlags = router.featureFlags;
  } catch (_e) {
    // ignore
  }

  const header = new MainHeader({
    router,
    version: APP_VERSION,
    sidebarWidth: SIDEBAR_WIDTH,
    padding: PAD,
  });
  const headerEl = header.render();
  router.openOutputMail = async () => {
    await header._openMailFileFlow();
  };
  router.openOutputPrint = async () => {
    await header._openPrintFileFlow();
  };
  router.openClosedProtocolSelector = async ({ mode } = {}) => {
    await header._openClosedProtocolSelectorFlow(mode || "view");
  };

  const featureToggleWrap = document.createElement("div");
  featureToggleWrap.style.gridColumn = "3";
  featureToggleWrap.style.gridRow = "3";
  featureToggleWrap.style.justifySelf = "end";
  featureToggleWrap.style.alignSelf = "end";
  featureToggleWrap.style.display = "inline-flex";
  featureToggleWrap.style.alignItems = "center";
  featureToggleWrap.style.gap = "8px";

  const featureToggleLabel = document.createElement("span");
  featureToggleLabel.textContent = "Beta: Firmen/Mitarbeiter v2";
  featureToggleLabel.style.fontSize = "12px";
  featureToggleLabel.style.opacity = "0.85";
  featureToggleLabel.style.userSelect = "none";

  const featureToggleBtn = document.createElement("button");
  featureToggleBtn.type = "button";
  featureToggleBtn.style.padding = "4px 8px";
  featureToggleBtn.style.minHeight = "24px";
  featureToggleBtn.style.borderRadius = "999px";
  featureToggleBtn.style.fontSize = "11px";
  featureToggleBtn.style.fontWeight = "700";
  featureToggleBtn.style.lineHeight = "1";
  featureToggleBtn.style.cursor = "pointer";

  const applyFeatureToggleUi = () => {
    const on = !!router?.featureFlags?.useNewCompanyWorkflow;
    featureToggleBtn.textContent = on ? "AN" : "AUS";
    featureToggleBtn.style.border = on ? "1px solid #7aa7ff" : "1px solid #ddd";
    featureToggleBtn.style.background = on ? "#eaf3ff" : "#fff";
    featureToggleBtn.style.color = on ? "#0b4db4" : "#555";
  };

  featureToggleBtn.onclick = () => {
    const next = !router?.featureFlags?.useNewCompanyWorkflow;
    if (router?.featureFlags) {
      router.featureFlags.useNewCompanyWorkflow = next;
    }
    writeUseNewCompanyWorkflowFlag(next);
    applyFeatureToggleUi();
    try {
      window.dispatchEvent(
        new CustomEvent("bbm:sticky-notice", {
          detail: {
            message: `Beta Firmen/Mitarbeiter v2: ${
              next ? "AN" : "AUS"
            } (wirksam ab naechstem Oeffnen der entsprechenden Ansicht)`,
          },
        })
      );
    } catch (_e) {
      // ignore
    }
  };

  applyFeatureToggleUi();
  featureToggleWrap.append(featureToggleLabel, featureToggleBtn);
  featureToggleWrap.style.display = "none";

  const applyThemeFromRouterContext = () => {
    applyThemeForSettings(router?.context?.settings || {});
  };

  router.refreshHeader = () => {
    applyThemeFromRouterContext();
    header.refresh();
  };
  window.addEventListener("bbm:header-refresh", () => {
    applyThemeFromRouterContext();
    header.refresh();
  });
  window.addEventListener("bbm:theme-refresh", () => {
    applyThemeFromRouterContext();
    header.refresh();
  });

  host.append(headerEl, bodyRow);

  window.addEventListener("bbm:sticky-notice", (e) => {
    const msg = e?.detail?.message || "";
    router.context = router.context || {};
    router.context.ui = router.context.ui || {};
    router.context.ui.stickyNotice = msg;
    header.refresh();
  });

  // Der fruehere Runtime-Klickblocker-Guard hat mit Popup-Overlay-Klicks kollidiert
  // und konnte die App in einen gesperrten Zustand bringen. Daher deaktiviert.

  const runNavSafe = (fn) => {
    return async () => {
      try {
        await fn();
      } catch (e) {
        console.error("[nav] failed:", e);
        alert(e?.message || String(e) || "Navigation fehlgeschlagen");
      } finally {
        header.refresh();
        updateContextButtons();
      }
    };
  };

  const mkNavBtn = (key, label, onClick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.display = "flex";
    b.style.alignItems = "center";
    b.style.width = "100%";
    b.style.boxSizing = "border-box";
    b.style.padding = "10px 10px";
    b.style.borderRadius = "8px";
    b.style.cursor = "pointer";
    b.style.background = "transparent";
    b.style.border = "1px solid rgba(226, 232, 240, 0.28)";
    b.style.boxShadow = "none";
    b.style.appearance = "none";
    b.style.color = "var(--sidebar-text)";
    b.style.textAlign = "left";
    b.style.transition = "background 120ms ease, border-color 120ms ease";
    b.onmouseenter = () => {
      if (b.disabled || b.dataset.active === "true") return;
      b.style.background = "var(--sidebar-hover-bg)";
    };
    b.onmouseleave = () => {
      if (b.disabled || b.dataset.active === "true") return;
      b.style.background = "transparent";
    };
    b.onclick = runNavSafe(onClick);

    buttonsByKey.set(key, b);
    return b;
  };

  const mkActionBtn = (label, onClick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.display = "flex";
    b.style.alignItems = "center";
    b.style.width = "100%";
    b.style.boxSizing = "border-box";
    b.style.padding = "10px 10px";
    b.style.borderRadius = "8px";
    b.style.cursor = "pointer";
    b.style.background = "transparent";
    b.style.border = "1px solid rgba(226, 232, 240, 0.28)";
    b.style.boxShadow = "none";
    b.style.appearance = "none";
    b.style.color = "var(--sidebar-text)";
    b.style.textAlign = "left";
    b.style.transition = "background 120ms ease, border-color 120ms ease";
    b.onmouseenter = () => {
      if (b.disabled) return;
      b.style.background = "var(--sidebar-hover-bg)";
    };
    b.onmouseleave = () => {
      if (b.disabled) return;
      b.style.background = "transparent";
    };
    b.onclick = runNavSafe(onClick);
    return b;
  };

  const setBtnEnabled = (btn, enabled, titleWhenDisabled) => {
    if (!btn) return;
    const isEnabled = !!enabled;
    btn.disabled = !isEnabled;
    btn.style.opacity = isEnabled ? "1" : "0.55";
    btn.style.cursor = isEnabled ? "pointer" : "not-allowed";
    btn.title = isEnabled ? "" : (titleWhenDisabled || "");
  };

  const btnHome = mkNavBtn("home", "Home", () => router.showHome());
  const btnProjects = mkNavBtn("projects", "Projekte", () => router.showProjects());

  const btnMeetings = mkNavBtn("meetings", "Protokolle", async () => {
    if (router.currentProjectId) {
      await router.showMeetings(router.currentProjectId);
      return;
    }
    alert("Bitte zuerst ein Projekt auswählen.");
    await router.showProjects();
  });

  const btnParticipants = mkActionBtn("Teilnehmer", async () => {
    if (!router.currentProjectId) {
      alert("Bitte zuerst ein Projekt auswählen.");
      return;
    }
    if (!router.currentMeetingId) {
      alert("Bitte zuerst eine Besprechung öffnen.");
      return;
    }
    await router.openParticipantsModal({
      projectId: router.currentProjectId,
      meetingId: router.currentMeetingId,
    });
  });


  const btnProjectFirms = mkNavBtn("projectFirms", "Projektfirmen", async () => {
    if (router.currentProjectId) {
      await router.showProjectFirms(router.currentProjectId);
      return;
    }
    alert("Bitte zuerst ein Projekt auswählen.");
    await router.showProjects();
  });

  const btnFirms = mkNavBtn("firms", "Firmen (Stamm)", () => router.showFirms());
  const btnSettings = mkNavBtn("settings", "Einstellungen", () => router.showSettings());
  const btnHelp = mkNavBtn("help", "Hilfe", () => router.openHelpModal());

  topBox.append(
    btnHome,
    btnProjects,
    btnMeetings,
    btnParticipants,
    btnProjectFirms,
    btnFirms,
    btnSettings,
    btnHelp
  );

  const btnQuit = document.createElement("button");
  btnQuit.textContent = "Beenden";
  btnQuit.dataset.variant = "danger";
  btnQuit.style.width = "100%";
  btnQuit.style.padding = "10px 10px";
  btnQuit.style.borderRadius = "8px";
  btnQuit.style.cursor = "pointer";
  btnQuit.style.border = "1px solid #b71c1c";
  btnQuit.style.background = "#c62828";
  btnQuit.style.color = "white";
  btnQuit.style.fontWeight = "700";

  btnQuit.onclick = async () => {
    try {
      if (!window.bbmDb || typeof window.bbmDb.appQuit !== "function") {
        alert("appQuit ist nicht verfügbar (Preload/IPC fehlt).");
        return;
      }

      if (typeof window.bbmDb.topsPurgeTrashedGlobal === "function") {
        try {
          const purgeRes = await Promise.race([
            window.bbmDb.topsPurgeTrashedGlobal(),
            new Promise((resolve) => setTimeout(() => resolve({ ok: false, timeout: true }), 1000)),
          ]);
          if (purgeRes?.timeout) {
            console.warn("[app] topsPurgeTrashedGlobal timeout before quit");
          } else if (purgeRes?.ok === false) {
            console.warn("[app] topsPurgeTrashedGlobal failed before quit:", purgeRes.error);
          }
        } catch (err) {
          console.warn("[app] topsPurgeTrashedGlobal error before quit:", err);
        }
      }

      await window.bbmDb.appQuit();
    } catch (e) {
      alert(e?.message || "Beenden fehlgeschlagen");
    }
  };

  bottomBox.append(btnQuit);

  const updateContextButtons = () => {
    const hasProject = !!router.currentProjectId;
    const hasMeeting = !!router.currentMeetingId;

    setBtnEnabled(btnMeetings, hasProject, "Bitte zuerst ein Projekt auswählen.");
    setBtnEnabled(btnProjectFirms, hasProject, "Bitte zuerst ein Projekt auswählen.");

    if (!hasProject) {
      setBtnEnabled(btnParticipants, false, "Bitte zuerst ein Projekt auswählen.");
    } else if (!hasMeeting) {
      setBtnEnabled(btnParticipants, false, "Bitte zuerst eine Besprechung öffnen.");
    } else {
      setBtnEnabled(btnParticipants, true, "");
    }

  };

  window.addEventListener("bbm:router-context", () => {
    updateContextButtons();
  });

  router.showHome();
  header.refresh();
  updateContextButtons();
  // Start-Popup "Initialisiere ..." deaktiviert
  // Start-Popup "Was ist neu/geändert" ist deaktiviert.
  };

  const initUiNew = () => {
    initUiOld();

    const sidebar = document.querySelector('[data-bbm-sidebar="true"]');
    if (!sidebar) return;

    const normalize = (value) => String(value || "").trim().toLowerCase();
    const getButton = (labels) => {
      const targets = Array.isArray(labels) ? labels : [labels];
      return Array.from(sidebar.querySelectorAll("button")).find((btn) => {
        const t = normalize(btn.textContent);
        return targets.some((label) => normalize(label) === t);
      }) || null;
    };

    const btnStart = getButton(["home", "start"]);
    const btnProjects = getButton("projekte");
    const btnFirmsBase = getButton(["firmen (stamm)", "firmenstamm"]);
    const btnSettings = getButton("einstellungen");
    const btnHelp = getButton("hilfe");
    const btnQuit = getButton("beenden");

    if (!btnStart || !btnProjects || !btnFirmsBase || !btnSettings || !btnHelp || !btnQuit) return;

    btnStart.textContent = "Start";
    btnProjects.textContent = "Projekte";
    btnFirmsBase.textContent = "Firmen (extern)";
    btnSettings.textContent = "Einstellungen";
    btnHelp.textContent = "Hilfe";
    btnQuit.textContent = "Beenden";

    const sidebarSections = Array.from(sidebar.children);
    const topSection = sidebarSections[0] || null;
    const bottomSection = sidebarSections[1] || null;
    if (!topSection || !bottomSection) return;

    topSection.replaceChildren(btnStart, btnProjects, btnFirmsBase, btnSettings, btnHelp);
    bottomSection.replaceChildren(btnQuit);
  };

  const canContinue = await enforceTrialLimit();
  if (!canContinue) return;
  await ensureInitialPrintLayoutDefaults();

  const uiMode = readUiMode();

  if (uiMode === "new") {
    initUiNew();
  } else {
    initUiOld();
  }
});
