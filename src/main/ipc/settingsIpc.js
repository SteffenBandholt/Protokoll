// src/main/ipc/settingsIpc.js
const { ipcMain, dialog, BrowserWindow, shell } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  initDatabase,
  getDatabaseDiagnostics,
  importLegacyIntoActive,
} = require("../db/database");
const { appSettingsGetMany, appSettingsSetMany, appSettingsGetManyWithDb, appSettingsSetManyWithDb } = require("../db/appSettingsRepo");
const { getUserProfile, upsertUserProfile } = require("../db/userProfileRepo");
const firmsRepo = require("../db/firmsRepo");
const projectFirmsRepo = require("../db/projectFirmsRepo");

const DEFAULT_ROLE_LABELS = {
  10: "Bauherr",
  20: "Planer",
  30: "Sachverstaendige",
  40: "Ing.-Bueros",
  50: "Gewerke",
  60: "Sonstige",
};
const DEFAULT_ROLE_ORDER = [10, 20, 30, 40, 50, 60];
const FALLBACK_ROLE_CODE = 60;
const SETTINGS_PIN_KEYS = [
  "security.settingsPinEnabled",
  "security.settingsPinSalt",
  "security.settingsPinHash",
];

function _normalizePin(raw) {
  return String(raw == null ? "" : raw).replace(/\D+/g, "").slice(0, 4);
}

function _isValidPin(raw) {
  return /^\d{4}$/.test(String(raw || ""));
}

function _hashPin(pin, saltHex) {
  const salt = Buffer.from(saltHex, "hex");
  return crypto.scryptSync(pin, salt, 64).toString("hex");
}

function _timingSafeHexEq(aHex, bHex) {
  try {
    const a = Buffer.from(String(aHex || ""), "hex");
    const b = Buffer.from(String(bHex || ""), "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function _verifyPinAgainstSettings(pinRaw, settings) {
  const pin = _normalizePin(pinRaw);
  if (!_isValidPin(pin)) return false;
  const enabled = String(settings?.["security.settingsPinEnabled"] || "").trim() === "1";
  const salt = String(settings?.["security.settingsPinSalt"] || "").trim();
  const hash = String(settings?.["security.settingsPinHash"] || "").trim();
  if (!enabled || !salt || !hash) return false;
  const calc = _hashPin(pin, salt);
  return _timingSafeHexEq(calc, hash);
}

function _normalizeRoleLabels(raw) {
  let parsed = null;
  try {
    const obj = JSON.parse(raw || "{}");
    if (obj && typeof obj === "object" && !Array.isArray(obj)) parsed = obj;
  } catch {
    parsed = null;
  }

  const out = { ...DEFAULT_ROLE_LABELS };
  if (parsed) {
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(k);
      if (!Number.isFinite(n) || n <= 0) continue;
      const label = String(v ?? "").trim();
      if (!label) continue;
      out[n] = label;
    }
  }

  if (!out[FALLBACK_ROLE_CODE]) out[FALLBACK_ROLE_CODE] = DEFAULT_ROLE_LABELS[FALLBACK_ROLE_CODE];
  return out;
}

function _normalizeRoleOrder(raw, labelsMap) {
  const labelCodes = Object.keys(labelsMap || {})
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n > 0);

  let parsed = [];
  try {
    const arr = JSON.parse(raw || "[]");
    if (Array.isArray(arr)) parsed = arr;
  } catch {
    parsed = [];
  }

  const out = [];
  const seen = new Set();
  for (const v of parsed) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (seen.has(n)) continue;
    out.push(n);
    seen.add(n);
  }

  for (const n of DEFAULT_ROLE_ORDER) {
    if (seen.has(n)) continue;
    out.push(n);
    seen.add(n);
  }

  const extras = labelCodes.filter((n) => !seen.has(n));
  extras.sort((a, b) => a - b);
  for (const n of extras) out.push(n);

  if (!out.includes(FALLBACK_ROLE_CODE)) out.push(FALLBACK_ROLE_CODE);
  return out;
}

function registerSettingsIpc() {
  ipcMain.handle("appSettings:getMany", async (_evt, keys) => {
    try {
      if (!Array.isArray(keys)) return { ok: false, error: "keys muss ein Array sein" };

      const clean = keys.map((k) => (k == null ? "" : String(k)).trim()).filter(Boolean);
      const data = appSettingsGetMany(clean);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("appSettings:setMany", async (_evt, payload) => {
    try {
      if (!payload || typeof payload !== "object") {
        return { ok: false, error: "payload muss ein Objekt sein" };
      }

      // Nur diese Keys zulassen (Header rechts 2 Zeilen + Firmen-Kategorien-Order)
      const allowed = new Set([
        "user_name",
        "user_company",
        "user_name1",
        "user_name2",
        "user_street",
        "user_zip",
        "user_city",
        "firm_role_order",
        "firm_role_labels",
        "header.logoSizePx",
        "header.logoPadLeftPx",
        "header.logoPadTopPx",
        "header.logoPadRightPx",
        "header.logoPosition",
        "header.logoEnabled",
        "ui.themeHeaderBaseColor",
        "ui.themeSidebarBaseColor",
        "ui.themeMainBaseColor",
        "ui.themeHeaderTone",
        "ui.themeSidebarTone",
        "ui.themeMainTone",
        "ui.themeHeaderMode",
        "ui.themeSidebarMode",
        "ui.themeMainMode",
        "ui.themeHeaderUseDefault",
        "ui.themeSidebarUseDefault",
        "ui.themeMainUseDefault",
        "pdf.userLogoPngDataUrl",
        "pdf.userLogoEnabled",
        "pdf.userLogoWidthMm",
        "pdf.userLogoTopMm",
        "pdf.userLogoRightMm",
        "pdf.protocolTitle",
        "pdf.preRemarks",
        "pdf.userLogoFilePath",
        "pdf.trafficLightAllEnabled",
        "pdf.protocolsDir",
        "pdf.footerPlace",
        "pdf.footerDate",
        "pdf.footerName1",
        "pdf.footerName2",
        "pdf.footerRecorder",
        "pdf.footerStreet",
        "pdf.footerZip",
        "pdf.footerCity",
        "pdf.footerUseUserData",
        "print.logo1.enabled",
        "print.logo1.size",
        "print.logo1.align",
        "print.logo1.vAlign",
        "print.logo1.pngDataUrl",
        "print.logo2.enabled",
        "print.logo2.size",
        "print.logo2.align",
        "print.logo2.vAlign",
        "print.logo2.pngDataUrl",
        "print.logo3.enabled",
        "print.logo3.size",
        "print.logo3.align",
        "print.logo3.vAlign",
        "print.logo3.pngDataUrl",
        "print.logoSizePreset",
        "print.v2.globalHeaderAdaptive",
        "print.v2.pagePadLeftMm",
        "print.v2.pagePadRightMm",
        "print.v2.pagePadTopMm",
        "print.v2.pagePadBottomMm",
        "dbMigrationPromptDismissed",
        "tops.titleMax",
        "tops.longMax",
        "tops.level1Collapsed",
        "tops.showLongtextInList",
        "tops.fontscale.list",
        "tops.fontscale.editbox",
      ]);
      const data = {};

      for (const [k, v] of Object.entries(payload)) {
        const key = (k || "").toString().trim();
        if (!allowed.has(key)) continue;
        data[key] = (v == null ? "" : String(v)).trim();
      }

      appSettingsSetMany(data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("security:settingsPinStatus", async () => {
    try {
      const data = appSettingsGetMany(SETTINGS_PIN_KEYS);
      const enabled = String(data?.["security.settingsPinEnabled"] || "").trim() === "1";
      const hasHash = !!String(data?.["security.settingsPinHash"] || "").trim();
      const hasSalt = !!String(data?.["security.settingsPinSalt"] || "").trim();
      return { ok: true, enabled: enabled && hasHash && hasSalt };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("security:settingsPinSet", async (_evt, payload) => {
    try {
      const pin = _normalizePin(payload?.pin);
      const currentPin = _normalizePin(payload?.currentPin);
      if (!_isValidPin(pin)) {
        return { ok: false, error: "PIN muss genau 4 Ziffern haben." };
      }

      const settings = appSettingsGetMany(SETTINGS_PIN_KEYS);
      const enabled = String(settings?.["security.settingsPinEnabled"] || "").trim() === "1";
      const hasExisting = enabled && !!String(settings?.["security.settingsPinHash"] || "").trim();
      if (hasExisting && !_verifyPinAgainstSettings(currentPin, settings)) {
        return { ok: false, error: "Aktuelle PIN ist falsch." };
      }

      const salt = crypto.randomBytes(16).toString("hex");
      const hash = _hashPin(pin, salt);
      appSettingsSetMany({
        "security.settingsPinEnabled": "1",
        "security.settingsPinSalt": salt,
        "security.settingsPinHash": hash,
      });

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("security:settingsPinDisable", async (_evt, payload) => {
    try {
      const currentPin = _normalizePin(payload?.currentPin);
      const settings = appSettingsGetMany(SETTINGS_PIN_KEYS);
      const enabled = String(settings?.["security.settingsPinEnabled"] || "").trim() === "1";
      const hasExisting = enabled && !!String(settings?.["security.settingsPinHash"] || "").trim();
      if (hasExisting && !_verifyPinAgainstSettings(currentPin, settings)) {
        return { ok: false, error: "Aktuelle PIN ist falsch." };
      }

      appSettingsSetMany({
        "security.settingsPinEnabled": "0",
        "security.settingsPinSalt": "",
        "security.settingsPinHash": "",
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("userProfile:get", async () => {
    try {
      const profile = getUserProfile();
      return { ok: true, profile };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("userProfile:upsert", async (_evt, payload) => {
    try {
      if (!payload || typeof payload !== "object") {
        return { ok: false, error: "payload muss ein Objekt sein" };
      }

      const profile = upsertUserProfile({
        name1: payload.name1,
        name2: payload.name2,
        street: payload.street,
        zip: payload.zip,
        city: payload.city,
      });

      return { ok: true, profile };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("settings:categoriesDelete", async (_evt, payload) => {
    try {
      if (!payload || typeof payload !== "object") {
        return { ok: false, error: "payload muss ein Objekt sein" };
      }

      const code = Number(payload.code);
      const fallbackCode = Number(payload.fallbackCode ?? FALLBACK_ROLE_CODE);

      if (!Number.isFinite(code) || code <= 0) {
        return { ok: false, error: "code ungültig" };
      }
      if (!Number.isFinite(fallbackCode) || fallbackCode <= 0) {
        return { ok: false, error: "fallbackCode ungültig" };
      }
      if (fallbackCode !== FALLBACK_ROLE_CODE) {
        return { ok: false, error: "fallbackCode ist nicht erlaubt" };
      }
      if (code === fallbackCode) {
        return { ok: false, error: "Fallback-Kategorie darf nicht gelöscht werden" };
      }

      const db = initDatabase();
      const tx = db.transaction(() => {
        const settings = appSettingsGetManyWithDb(db, [
          "firm_role_order",
          "firm_role_labels",
        ]);

        const labels = _normalizeRoleLabels(settings.firm_role_labels || "");
        const order = _normalizeRoleOrder(settings.firm_role_order || "", labels);

        const firmsCount = firmsRepo.countByRoleCode(code, db);
        const projectCount = projectFirmsRepo.countByRoleCode(code, db);

        const reassignedFirms = firmsRepo.reassignRoleCode({
          fromCode: code,
          toCode: fallbackCode,
          dbConn: db,
        });
        const reassignedProjectFirms = projectFirmsRepo.reassignRoleCode({
          fromCode: code,
          toCode: fallbackCode,
          dbConn: db,
        });

        const nextOrder = order.filter((c) => Number(c) !== code);
        if (!nextOrder.includes(fallbackCode)) nextOrder.push(fallbackCode);

        const nextLabels = { ...labels };
        delete nextLabels[code];
        if (!nextLabels[fallbackCode]) {
          nextLabels[fallbackCode] = DEFAULT_ROLE_LABELS[FALLBACK_ROLE_CODE];
        }

        appSettingsSetManyWithDb(db, {
          firm_role_order: JSON.stringify(nextOrder),
          firm_role_labels: JSON.stringify(nextLabels),
        });

        return {
          reassignedCounts: {
            firms: reassignedFirms,
            projectFirms: reassignedProjectFirms,
          },
          matchedCounts: {
            firms: firmsCount,
            projectFirms: projectCount,
          },
        };
      });

      const result = tx();
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dialog:selectDirectory", async (evt, payload) => {
    try {
      const win = BrowserWindow.fromWebContents(evt.sender);
      const title = (payload?.title || "").toString().trim();
      const res = await dialog.showOpenDialog(win || null, {
        properties: ["openDirectory"],
        ...(title ? { title } : {}),
      });
      return {
        ok: true,
        canceled: !!res.canceled,
        filePaths: Array.isArray(res.filePaths) ? res.filePaths : [],
      };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dialog:selectCsvFile", async (evt, payload) => {
    try {
      const win = BrowserWindow.fromWebContents(evt.sender);
      const title = (payload?.title || "").toString().trim();
      const res = await dialog.showOpenDialog(win || null, {
        properties: ["openFile"],
        filters: [{ name: "CSV", extensions: ["csv"] }],
        ...(title ? { title } : {}),
      });
      return {
        ok: true,
        canceled: !!res.canceled,
        filePaths: Array.isArray(res.filePaths) ? res.filePaths : [],
      };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("db:diagnostics", async () => {
    try {
      return { ok: true, data: getDatabaseDiagnostics() };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("db:legacyImport", async () => {
    try {
      const result = importLegacyIntoActive();
      if (!result?.ok) {
        return { ok: false, error: result?.error || "Import fehlgeschlagen" };
      }
      appSettingsSetMany({ dbMigrationPromptDismissed: "0" });
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("db:openFolder", async (_evt, payload) => {
    try {
      const kind = String(payload?.kind || "").trim();
      const diag = getDatabaseDiagnostics();
      let targetPath = "";
      if (kind === "active") targetPath = diag.dbPath;
      if (kind === "legacyImport") targetPath = diag.legacyImportPath;
      if (!targetPath) return { ok: false, error: "ungueltiger Pfadtyp" };
      if (fs.existsSync(targetPath)) {
        shell.showItemInFolder(targetPath);
        return { ok: true };
      }
      const folderPath = path.dirname(targetPath);
      const errorText = await shell.openPath(folderPath);
      if (errorText) return { ok: false, error: errorText };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  console.log("[main] IPC registered: appSettings");
}

module.exports = { registerSettingsIpc };
