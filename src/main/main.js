// src/main/main.js
//
// TECH-CONTRACT (verbindlich): docs/UI-TECH-CONTRACT.md
// CONTRACT-VERSION: 1.0.1
//
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

// IPCs
const { registerProjectsIpc } = require("./ipc/projectsIpc");
const { registerMeetingsIpc } = require("./ipc/meetingsIpc");
const { registerTopsIpc } = require("./ipc/topsIpc");
const { registerProjectFirmsIpc } = require("./ipc/projectFirmsIpc");
const { registerParticipantsIpc } = require("./ipc/participantsIpc");
const { registerPrintIpc } = require("./ipc/printIpc");
const { registerSettingsIpc } = require("./ipc/settingsIpc");
const { appSettingsGetMany, appSettingsSetMany } = require("./db/appSettingsRepo");
const { getDatabaseDiagnostics, importLegacyIntoActive } = require("./db/database");

let mainWindow;
const WINDOWS_APP_ID = "de.bbm.baubesprechungsmanager";

function resolveIconPath() {
  const candidates = [
    path.join(__dirname, "..", "..", "build", "bbm-icon.ico"),
    path.join(process.resourcesPath, "app.asar", "build", "bbm-icon.ico"),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (err) {
      console.error("[main] icon path check failed:", candidate, err?.message || err);
    }
  }

  console.warn("[main] no bundled icon found, candidates:", candidates);
  return null;
}

function createWindow() {
  const isProd = app.isPackaged;
  const iconPath = resolveIconPath();
  const windowOptions = {
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      devTools: !isProd,
    },
  };

  if (iconPath) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow({
    ...windowOptions,
  });

  if (isProd) {
    if (process.platform === "win32" || process.platform === "linux") {
      Menu.setApplicationMenu(null);
    }
    mainWindow.webContents.on("before-input-event", (event, input) => {
      const key = (input?.key || "").toLowerCase();
      const hasShift = !!input?.shift;
      const hasCtrl = !!input?.control;
      const hasMeta = !!input?.meta;
      const hasAlt = !!input?.alt;
      const mod = hasCtrl || hasMeta;
      const isF12 = key === "f12";
      const isCtrlShiftI = mod && hasShift && key === "i";
      const isCtrlShiftJ = mod && hasShift && key === "j";
      const isMacAltI = process.platform === "darwin" && hasMeta && hasAlt && key === "i";
      if (isF12 || isCtrlShiftI || isCtrlShiftJ || isMacAltI) {
        event.preventDefault();
      }
    });
  }

  // ✅ WICHTIG: aus SRC laden, nicht dist
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  // DevTools NICHT automatisch öffnen (nur bei Bedarf manuell)
  if (!app.isPackaged) {
    // mainWindow.webContents.openDevTools();
  }
}

if (process.platform === "win32") {
  app.setAppUserModelId(WINDOWS_APP_ID);
}

process.on("uncaughtException", (err) => {
  console.error("[main] uncaughtException:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[main] unhandledRejection:", reason);
});

async function maybePromptLegacyMigration(win) {
  const migrationFlag = appSettingsGetMany(["dbMigrationPromptDismissed"]);
  const dismissed = String(migrationFlag?.dbMigrationPromptDismissed || "").trim() === "1";
  const diag = getDatabaseDiagnostics();

  if (!diag.legacyAvailable || !diag.activeLikelyEmpty || dismissed) return;

  const fmt = (meta = {}) => {
    const exists = meta.exists ? "ja" : "nein";
    const size = Number(meta.size || 0);
    return `${exists}, ${size} Bytes`;
  };

  const detail = [
    "Es wurde eine vorhandene Datenbank gefunden. Moechtest du diese uebernehmen?",
    "",
    `Aktive DB: ${diag.dbPath}`,
    `Status: ${fmt(diag.db)}`,
    "",
    `Legacy: ${diag.legacySourcePath || diag.legacyDbPath}`,
    `Status: ${fmt(diag.legacyImport?.exists ? diag.legacyImport : diag.legacy)}`,
  ].join("\n");

  const res = await dialog.showMessageBox(win, {
    type: "question",
    buttons: ["Uebernehmen", "Nicht uebernehmen", "Spaeter"],
    defaultId: 0,
    cancelId: 2,
    title: "Daten uebernehmen?",
    message: "Daten uebernehmen?",
    detail,
    noLink: true,
  });

  if (res.response === 0) {
    const imp = importLegacyIntoActive();
    if (!imp.ok) {
      await dialog.showMessageBox(win, {
        type: "error",
        title: "Import fehlgeschlagen",
        message: imp.error || "Legacy-Import konnte nicht ausgefuehrt werden.",
      });
      return;
    }
    appSettingsSetMany({ dbMigrationPromptDismissed: "0" });
    if (!win.isDestroyed()) win.webContents.reloadIgnoringCache();
    return;
  }

  if (res.response === 2) {
    appSettingsSetMany({ dbMigrationPromptDismissed: "1" });
  }
}

app.whenReady().then(async () => {
  // ✅ IPCs zuerst registrieren (verhindert "No handler registered" beim invoke)
  registerProjectsIpc();
  registerMeetingsIpc();
  registerTopsIpc();
  registerProjectFirmsIpc();
  registerParticipantsIpc();
  registerPrintIpc();
  registerSettingsIpc();

  // ✅ App beenden (ohne Confirm) – über IPC
  ipcMain.handle("app:quit", () => {
    try {
      app.quit();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("app:getBundledIconPath", () => {
    try {
      return { ok: true, path: resolveIconPath() || "" };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("app:isWindows", () => {
    try {
      return { ok: true, isWindows: process.platform === "win32" };
    } catch (err) {
      return { ok: false, error: err?.message || String(err), isWindows: false };
    }
  });

  ipcMain.handle("app:openQuickAssist", async () => {
    if (process.platform !== "win32") {
      return { ok: false, error: "Schnellhilfe ist nur unter Windows verfügbar." };
    }

    try {
      await shell.openExternal("ms-quick-assist:");
      return { ok: true, method: "protocol" };
    } catch (errProtocol) {
      console.error("[main] app:openQuickAssist protocol failed", {
        error: errProtocol?.stack || errProtocol?.message || String(errProtocol),
      });

      try {
        await new Promise((resolve, reject) => {
          const child = spawn("quickassist.exe", [], {
            detached: true,
            stdio: "ignore",
            windowsHide: true,
          });

          child.once("error", (spawnErr) => reject(spawnErr));
          child.once("spawn", () => {
            try {
              child.unref();
            } catch (_) {}
            resolve(true);
          });
        });
        return { ok: true, method: "spawn" };
      } catch (errSpawn) {
        console.error("[main] app:openQuickAssist fallback spawn failed", {
          error: errSpawn?.stack || errSpawn?.message || String(errSpawn),
        });
        return { ok: false, error: "Schnellhilfe konnte nicht gestartet werden." };
      }
    }
  });

  console.log(
    "[main] IPC registered: projects, meetings, tops, projectFirms, participants, print, settings, app:*"
  );

  // Fenster erst danach (damit Renderer nichts "zu früh" invoken kann)
  createWindow();
  await maybePromptLegacyMigration(mainWindow);
});

app.on("window-all-closed", () => {
  if (process.platform === "win32") {
    app.quit();
    return;
  }
  if (process.platform !== "darwin") app.quit();
});
