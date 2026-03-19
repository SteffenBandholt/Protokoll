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
const { registerProjectSettingsIpc } = require("./ipc/projectSettingsIpc");
const { registerEditorIpc } = require("./ipc/editorIpc");
const { registerProjectTransferIpc } = require("./ipc/projectTransferIpc");
const { registerLicenseIpc } = require("./ipc/licenseIpc");
const { registerAudioIpc } = require("./ipc/audioIpc");
const { checkLicense } = require("./licensing/licenseService");
const {
  toLicenseErrorPayload,
  isDevAudioOverrideEnabled,
  isDevAudioSuggestionsEnabled,
} = require("./licensing/featureGuard");
const { appSettingsGetMany, appSettingsSetMany } = require("./db/appSettingsRepo");
const { getDatabaseDiagnostics, importLegacyIntoActive } = require("./db/database");
const firmsRepo = require("./db/firmsRepo");
const personsRepo = require("./db/personsRepo");
const { buildStoragePreviewPaths } = require("./ipc/projectStoragePaths");

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

const DEV_ONLY_ERROR = "Nur im Entwicklermodus verfuegbar.";

function _findPackageJsonUp(startDir) {
  if (!startDir) return null;
  let current = path.resolve(startDir);
  const root = path.parse(current).root;
  while (true) {
    const candidate = path.join(current, "package.json");
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_err) {
      // ignore and continue upwards
    }
    if (current === root) break;
    current = path.dirname(current);
  }
  return null;
}

function _resolveProjectRoot() {
  const starts = [];
  try {
    starts.push(app.getAppPath());
  } catch (_err) {
    // ignore
  }
  starts.push(process.cwd());
  starts.push(path.join(__dirname, "..", ".."));

  for (const rawStart of starts) {
    const start = String(rawStart || "").trim();
    if (!start) continue;
    let startDir = start;
    try {
      const stat = fs.existsSync(start) ? fs.statSync(start) : null;
      if (stat && stat.isFile()) startDir = path.dirname(start);
    } catch (_err) {
      // ignore
    }
    const pkgPath = _findPackageJsonUp(startDir);
    if (pkgPath) return path.dirname(pkgPath);
  }
  return null;
}

async function _readJsonFile(filePath) {
  const raw = await fs.promises.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function _writeJsonAtomic(filePath, data) {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  await fs.promises.writeFile(tempPath, payload, "utf8");
  try {
    await fs.promises.rename(tempPath, filePath);
  } catch (err) {
    if (err && (err.code === "EEXIST" || err.code === "EPERM")) {
      try {
        await fs.promises.unlink(filePath);
      } catch (_unlinkErr) {
        // ignore
      }
      await fs.promises.rename(tempPath, filePath);
      return;
    }
    throw err;
  }
}

function _parseSemver(version) {
  const raw = String(version || "").trim();
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(raw);
  if (!match) throw new Error(`Ungueltige SemVer-Version: ${raw || "(leer)"}`);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function _formatSemver(parts) {
  return `${parts.major}.${parts.minor}.${parts.patch}`;
}

function _bumpSemver(version, kind) {
  const current = _parseSemver(version);
  const mode = String(kind || "").trim().toLowerCase();
  if (mode === "patch") return _formatSemver({ ...current, patch: current.patch + 1 });
  if (mode === "minor") {
    return _formatSemver({ major: current.major, minor: current.minor + 1, patch: 0 });
  }
  if (mode === "major") return _formatSemver({ major: current.major + 1, minor: 0, patch: 0 });
  throw new Error(`Unbekannter Release-Typ: ${kind}`);
}

async function _loadRepoVersionFiles(projectRoot) {
  const packagePath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(packagePath)) {
    throw new Error("package.json nicht gefunden.");
  }
  const packageData = await _readJsonFile(packagePath);
  const repoVersion = String(packageData?.version || "").trim();
  if (!repoVersion) throw new Error("In package.json fehlt die Versionsnummer.");
  _parseSemver(repoVersion);
  const lockPath = path.join(projectRoot, "package-lock.json");
  const hasLock = fs.existsSync(lockPath);
  const lockData = hasLock ? await _readJsonFile(lockPath) : null;
  return {
    repoVersion,
    packagePath,
    packageData,
    lockPath,
    lockData,
    hasLock,
  };
}

async function _setRepoVersion(nextVersion) {
  _parseSemver(nextVersion);
  const projectRoot = _resolveProjectRoot();
  if (!projectRoot) throw new Error("Projektroot mit package.json konnte nicht ermittelt werden.");
  const files = await _loadRepoVersionFiles(projectRoot);
  const next = String(nextVersion);

  const packageData = { ...files.packageData, version: next };
  await _writeJsonAtomic(files.packagePath, packageData);

  if (files.hasLock && files.lockData) {
    const lockData = { ...files.lockData, version: next };
    if (lockData.packages && typeof lockData.packages === "object" && lockData.packages[""]) {
      lockData.packages[""] = {
        ...lockData.packages[""],
        version: next,
      };
    }
    await _writeJsonAtomic(files.lockPath, lockData);
  }

  return next;
}

// ============================================================
// ✅ Build Channel (Repo-Schalter + Laufzeitinfo fürs Badge)
// ============================================================
function _normalizeChannel(v) {
  const s = String(v || "").trim().toUpperCase();
  return s === "DEV" ? "DEV" : "STABLE";
}

function _getRepoChannelFilePath() {
  const projectRoot = _resolveProjectRoot();
  if (!projectRoot) return null;
  return path.join(projectRoot, "channel.json");
}

async function _readRepoBuildChannel() {
  const p = _getRepoChannelFilePath();
  if (!p) return "DEV";
  try {
    if (!fs.existsSync(p)) return "DEV";
    const raw = await fs.promises.readFile(p, "utf8");
    const data = JSON.parse(raw);
    return _normalizeChannel(data?.channel);
  } catch (_e) {
    return "DEV";
  }
}

async function _writeRepoBuildChannel(next) {
  const p = _getRepoChannelFilePath();
  if (!p) throw new Error("Projektroot konnte nicht ermittelt werden (channel.json).");
  const channel = _normalizeChannel(next);
  await _writeJsonAtomic(p, { channel });
  return channel;
}

// ✅ für EXE: buildChannel aus gepackter package.json (extraMetadata)
function _readPackagedBuildChannel() {
  try {
    const pkgPath = path.join(app.getAppPath(), "package.json");
    const raw = fs.readFileSync(pkgPath, "utf8");
    const data = JSON.parse(raw);
    const ch = _normalizeChannel(data?.buildChannel);
    return ch;
  } catch (_e) {
    return "STABLE";
  }
}

function createWindow() {
  const isProd = app.isPackaged;
  const iconPath = resolveIconPath();
  const windowOptions = {
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
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
  registerProjectSettingsIpc();
  registerEditorIpc({ getMainWindow: () => mainWindow });
  registerProjectTransferIpc();
  registerLicenseIpc();
  registerAudioIpc();

  // ============================================================
  // ✅ Build Channel IPCs
  // ============================================================
  ipcMain.handle("app:getBuildChannel", async () => {
    try {
      // DEV beim Entwickeln (npm start)
      if (!app.isPackaged) return { ok: true, channel: "DEV" };
      // Packaged: aus extraMetadata.buildChannel (package.json im asar)
      return { ok: true, channel: _readPackagedBuildChannel() };
    } catch (err) {
      return { ok: false, error: err?.message || String(err), channel: "STABLE" };
    }
  });

  ipcMain.handle("dev:buildChannelGet", async () => {
    if (app.isPackaged) return { ok: false, error: DEV_ONLY_ERROR };
    try {
      const channel = await _readRepoBuildChannel();
      return { ok: true, channel };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dev:buildChannelSet", async (_event, payload) => {
    if (app.isPackaged) return { ok: false, error: DEV_ONLY_ERROR };
    try {
      const next = _normalizeChannel(payload?.channel ?? payload?.value ?? payload?.buildChannel);
      const saved = await _writeRepoBuildChannel(next);
      return { ok: true, channel: saved };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dev:audioUnlockStatus", async () => {
    try {
      return { ok: true, enabled: !!isDevAudioOverrideEnabled() };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dev:audioSuggestionsEnabled", async () => {
    try {
      return { ok: true, enabled: !!isDevAudioSuggestionsEnabled() };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

ipcMain.handle("mail:createOutlookDraft", async (_event, payload) => {
  try {
    if (process.platform !== "win32") {
      return { ok: false, error: "Outlook-Entwurf ist nur unter Windows verfügbar." };
    }

    const to = Array.isArray(payload?.to)
      ? payload.to.map((v) => String(v || "").trim()).filter(Boolean)
      : String(payload?.to || "")
          .split(/[;,]/)
          .map((v) => String(v || "").trim())
          .filter(Boolean);

    const subject = String(payload?.subject || "").trim();
    const body = String(payload?.body || "");
    const attachmentPath = String(payload?.attachmentPath || "").trim();
    const attachmentsArr = Array.isArray(payload?.attachments)
      ? payload.attachments.map((v) => String(v || "").trim()).filter(Boolean)
      : [];
    const allAttachments = [];
    if (attachmentsArr.length) allAttachments.push(...attachmentsArr);
    if (attachmentPath) allAttachments.push(attachmentPath);

    const dedup = [];
    const seen = new Set();
    for (const a of allAttachments) {
      const key = a.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(a);
    }

    if (!dedup.length) {
      return { ok: false, error: "Anhangspfad fehlt." };
    }
    const missing = dedup.find((p) => !fs.existsSync(p));
    if (missing) {
      return { ok: false, error: "Anhang nicht gefunden." };
    }

    const tempDir = app.getPath("temp");
    const scriptPath = path.join(tempDir, `bbm_outlook_draft_${Date.now()}.ps1`);
    const script = [
      'param(',
      '  [string]$To = "",',
      '  [string]$Subject = "",',
      '  [string]$Body = "",',
      '  [string]$AttachmentsBase64 = ""',
      ')',
      '$ErrorActionPreference = "Stop"',
      '$Attachments = @()',
      'if ($AttachmentsBase64) {',
      '  $attachmentsJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($AttachmentsBase64))',
      '  $parsedAttachments = ConvertFrom-Json -InputObject $attachmentsJson',
      '  if ($parsedAttachments -is [System.Array]) {',
      '    $Attachments = @($parsedAttachments | ForEach-Object { [string]$_ })',
      '  } elseif ($parsedAttachments) {',
      '    $Attachments = @([string]$parsedAttachments)',
      '  }',
      '}',
      '$outlook = New-Object -ComObject Outlook.Application',
      '$mail = $outlook.CreateItem(0)',
      'if ($To) { $mail.To = $To }',
      'if ($Subject) { $mail.Subject = $Subject }',
      'if ($Body) { $mail.Body = $Body }',
      'if ($Attachments) {',
      '  foreach ($att in $Attachments) {',
      '    if ($att -and (Test-Path -LiteralPath $att)) {',
      '      [void]$mail.Attachments.Add($att)',
      '    }',
      '  }',
      '}',
      '$mail.Display()',
      ''
    ].join("\r\n");

    fs.writeFileSync(scriptPath, script, "utf8");

    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-STA",
      "-File",
      scriptPath,
      "-To",
      to.join("; "),
      "-Subject",
      subject,
      "-Body",
      body,
      "-AttachmentsBase64",
      Buffer.from(JSON.stringify(dedup), "utf8").toString("base64"),
    ];

    const result = await new Promise((resolve) => {
      let stderr = "";
      let settled = false;
      const child = spawn("powershell.exe", args, {
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
      });

      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, error: err?.message || String(err) });
      });

      if (child.stderr) {
        child.stderr.on("data", (chunk) => {
          stderr += String(chunk || "");
        });
      }

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        if (Number(code) === 0) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: stderr.trim() || `PowerShell exit ${code}` });
        }
      });
    });

    try {
      fs.unlinkSync(scriptPath);
    } catch (_err) {
      // ignore
    }

    return result;
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

  // ✅ App beenden (ohne Confirm) – über IPC
  ipcMain.handle("app:quit", () => {
    try {
      try {
        const personsRes = personsRepo.purgeTrashedSafe();
        if (Number(personsRes?.skippedReferenced || 0) > 0) {
          console.warn("[app:quit] persons purge skipped referenced:", personsRes);
        }
      } catch (err) {
        console.warn("[app:quit] persons purge failed:", err?.message || err);
      }

      try {
        const firmsRes = firmsRepo.purgeTrashedSafe();
        if (Number(firmsRes?.skippedReferenced || 0) > 0) {
          console.warn("[app:quit] firms purge skipped referenced:", firmsRes);
        }
      } catch (err) {
        console.warn("[app:quit] firms purge failed:", err?.message || err);
      }

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

  ipcMain.handle("app:isPackaged", () => {
    try {
      return { ok: true, isPackaged: !!app.isPackaged };
    } catch (err) {
      return { ok: false, error: err?.message || String(err), isPackaged: true };
    }
  });

  ipcMain.handle("app:getVersion", () => {
    try {
      return { ok: true, version: app.getVersion() };
    } catch (err) {
      return { ok: false, error: err?.message || String(err), version: "" };
    }
  });

  ipcMain.handle("dev:versionGet", async () => {
    if (app.isPackaged) return { ok: false, error: DEV_ONLY_ERROR };
    try {
      const projectRoot = _resolveProjectRoot();
      if (!projectRoot) {
        return { ok: false, error: "Projektroot mit package.json konnte nicht ermittelt werden." };
      }
      const files = await _loadRepoVersionFiles(projectRoot);
      return {
        ok: true,
        appVersion: String(app.getVersion() || "").trim(),
        repoVersion: files.repoVersion,
      };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dev:versionBump", async (_event, payload) => {
    if (app.isPackaged) return { ok: false, error: DEV_ONLY_ERROR };
    try {
      const kind = String(payload?.kind || "").trim().toLowerCase();
      const projectRoot = _resolveProjectRoot();
      if (!projectRoot) {
        return { ok: false, error: "Projektroot mit package.json konnte nicht ermittelt werden." };
      }
      const files = await _loadRepoVersionFiles(projectRoot);
      const nextVersion = _bumpSemver(files.repoVersion, kind);
      const repoVersion = await _setRepoVersion(nextVersion);
      return { ok: true, repoVersion };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dev:versionSet", async (_event, payload) => {
    if (app.isPackaged) return { ok: false, error: DEV_ONLY_ERROR };
    try {
      const nextVersion = String(payload?.version || "").trim();
      const repoVersion = await _setRepoVersion(nextVersion);
      return { ok: true, repoVersion };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dev:getStoragePreview", async (_event, payload) => {
    if (app.isPackaged) return { ok: false, error: DEV_ONLY_ERROR };
    try {
      const data = payload && typeof payload === "object" ? payload : {};
      const settings = appSettingsGetMany(["pdf.protocolsDir"]) || {};
      const baseDirRaw = String(settings["pdf.protocolsDir"] || "").trim();
      const baseDir = baseDirRaw || app.getPath("downloads");
      const preview = buildStoragePreviewPaths({
        baseDir,
        project: {
          project_number: data.project_number ?? data.projectNumber ?? data.number ?? "",
          short: data.short ?? "",
          name: data.name ?? "",
        },
      });
      return { ok: true, ...preview };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
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
    "[main] IPC registered: projects, meetings, tops, projectFirms, participants, print, settings, projectSettings, projectTransfer, license, audio, app:*"
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
