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
const DICTIONARY_ALLOWED_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".log",
  ".xml",
  ".html",
  ".htm",
  ".rtf",
  ".pdf",
]);
const DICTIONARY_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  ".vs",
  ".vscode",
  ".idea",
  "tmp",
  "temp",
]);
const DICTIONARY_MAX_FILE_SIZE = 10 * 1024 * 1024;
const DICTIONARY_STOPWORDS = new Set([
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "und",
  "oder",
  "nicht",
  "ein",
  "eine",
  "einer",
  "einem",
  "einen",
  "mit",
  "ohne",
  "im",
  "in",
  "am",
  "an",
  "auf",
  "ueber",
  "über",
  "unter",
  "bei",
  "nach",
  "vor",
  "bis",
  "aus",
  "fuer",
  "fur",
  "von",
  "ist",
  "sind",
  "war",
  "waren",
  "wird",
  "werden",
  "auch",
  "nur",
  "als",
  "wie",
  "zum",
  "zur",
  "dass",
  "bitte",
  "heute",
  "morgen",
  "gestern",
  "immer",
  "sofort",
  "erfolgt",
  "naechste",
  "nächste",
  "naechster",
  "naechstes",
  "wichtig",
  "neu",
  "fertig",
  "pruefen",
  "prüfen",
  "machen",
  "gemacht",
  "geht",
  "gehen",
  "kommt",
  "kommen",
  "einfach",
  "planen",
  "geplant",
  "klären",
  "klaeren",
  "haus",
  "schule",
  "geraet",
  "gerät",
  "ordnung",
  "arbeits",
  "protokoll",
  "baubesprechung",
  "offen",
  "erledigt",
  "status",
  "datum",
  "nr",
  "seite",
]);
const DICTIONARY_MIN_LEN = 5;
const DICTIONARY_SHORT_EXCEPTIONS = new Set([
  "sohl",
  "sohle",
  "rohr",
  "deck",
  "deckel",
  "wand",
  "dach",
  "fahr",
  "plan",
  "bema",
  "bemaß",
  "ava",
  "tga",
]);
const DICTIONARY_FRAGMENT_TOKENS = new Set([
  "fangung",
  "entwaesse",
  "entwaess",
  "leitungs",
  "sohl",
  "verleg",
  "unterf",
]);
const DICTIONARY_COMMON_WORDS = new Set([
  "heute",
  "morgen",
  "gestern",
  "jetzt",
  "immer",
  "sobald",
  "sofort",
  "dann",
  "noch",
  "wieder",
  "bereits",
  "neu",
  "wichtig",
  "fertig",
  "pruefen",
  "prüfen",
  "machen",
  "gemacht",
  "gehen",
  "kommt",
  "kommen",
  "sehen",
  "sehen",
  "frage",
  "fragen",
  "antwort",
  "bitte",
  "danke",
]);

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

function _normalizeDictionaryTerm(raw) {
  const lower = String(raw || "").toLowerCase();
  const swapped = lower
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
  return swapped.replace(/[^a-z0-9]/g, "");
}

async function _loadPdfJs() {
  try {
    // Lazy-load to avoid startup penalty if PDFs are not used.
    // eslint-disable-next-line global-require
    return require("pdfjs-dist/legacy/build/pdf.js");
  } catch (_err) {
    try {
      const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
      return mod?.getDocument ? mod : mod?.default || mod;
    } catch (err) {
      console.warn("[dictionary] pdfjs-dist fehlt", err?.message || err);
      return null;
    }
  }
}

async function _extractPdfText(filePath) {
  const pdfjs = await _loadPdfJs();
  if (!pdfjs) return { ok: false, error: "PDF-Text kann nicht gelesen werden (pdfjs-dist fehlt)." };
  const buffer = fs.readFileSync(filePath);
  const data = new Uint8Array(buffer);
  const standardFontsPath = path.resolve(__dirname, "../../../node_modules/pdfjs-dist/standard_fonts/");
  const cmapsPath = path.resolve(__dirname, "../../../node_modules/pdfjs-dist/cmaps/");
  const standardFontDataUrl = require("node:url").pathToFileURL(standardFontsPath).href;
  const cMapUrl = require("node:url").pathToFileURL(cmapsPath).href;
  const loadingTask = pdfjs.getDocument({
    data,
    disableWorker: true,
    standardFontDataUrl,
    cMapUrl,
    cMapPacked: true,
  });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let p = 1; p <= pdf.numPages; p += 1) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = (content.items || []).map((item) => item.str).join(" ");
    fullText += `${pageText}\n`;
  }
  return { ok: true, text: fullText, pages: pdf.numPages };
}

function _cleanPdfText(raw) {
  let text = String(raw || "");
  text = text.replace(/\r\n?/g, "\n");
  text = text.replace(/(\w)[-]\n(\w)/g, "$1$2");
  const lines = text.split("\n").map((line) => String(line || "").trim());
  const cleaned = [];
  for (const line of lines) {
    if (!line) continue;
    if (line.length <= 2) continue;
    if (/^[-_]{3,}$/.test(line)) continue;
    if (/^[\d\s.,;:/-]+$/.test(line)) continue;
    if ((line.match(/\|/g) || []).length >= 2) continue;
    cleaned.push(line);
  }
  text = cleaned.join("\n");
  text = text.replace(/([^\n])\n([^\n])/g, "$1 $2");
  text = text.replace(/\s{2,}/g, " ");
  return text.trim();
}

function _isLikelyTextBuffer(buffer) {
  if (!buffer || !buffer.length) return false;
  for (let i = 0; i < Math.min(buffer.length, 2048); i += 1) {
    if (buffer[i] === 0) return false;
  }
  return true;
}

function _extractDictionaryTermsFromText(text) {
  const out = new Map();
  const pattern = /[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9\-_/]{2,}/g;
  let match = null;
  while ((match = pattern.exec(text)) !== null) {
    const token = match[0] || "";
    if (token.length > 60) continue;
    if (/^[-_]/.test(token) || /[-_]$/.test(token)) continue;
    const norm = _normalizeDictionaryTerm(token);
    if (norm.length < 3) continue;
    if (norm.length < DICTIONARY_MIN_LEN && !DICTIONARY_SHORT_EXCEPTIONS.has(norm)) continue;
    if (/^\d+$/.test(norm)) continue;
    if (/^\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?$/.test(token)) continue;
    if (/^\d{4}[./-]\d{1,2}[./-]\d{1,2}$/.test(token)) continue;
    if (DICTIONARY_STOPWORDS.has(norm)) continue;
    if (DICTIONARY_STOPWORDS.has(String(token || "").toLowerCase())) continue;
    if (DICTIONARY_COMMON_WORDS.has(norm)) continue;
    if (DICTIONARY_FRAGMENT_TOKENS.has(norm)) continue;
    if (/^[a-zäöüß]+$/.test(token) && norm.length <= 5 && !DICTIONARY_SHORT_EXCEPTIONS.has(norm)) {
      continue;
    }
    if (/[a-z]/.test(token) && /[A-ZÄÖÜ]/.test(token) === false && token.length <= 5) {
      continue;
    }
    if (_isLikelyFragmentToken(norm, token)) continue;
    let entry = out.get(norm);
    if (!entry) {
      entry = {
        normKey: norm,
        count: 0,
        variants: new Set(),
        firstIndex: match.index,
      };
      out.set(norm, entry);
    }
    entry.count += 1;
    entry.variants.add(token);
  }

  const entries = [];
  for (const entry of out.values()) {
    const start = Math.max(0, (entry.firstIndex || 0) - 40);
    const end = Math.min(text.length, (entry.firstIndex || 0) + 60);
    const excerpt = String(text.slice(start, end)).replace(/\s+/g, " ").trim();
    entries.push({
      normKey: entry.normKey,
      count: entry.count,
      variants: Array.from(entry.variants),
      excerpt,
    });
  }
  return entries;
}

function _isLikelyFragmentToken(norm, rawToken) {
  if (!norm) return true;
  if (DICTIONARY_SHORT_EXCEPTIONS.has(norm)) return false;
  if (norm.length < 5) return true;
  const token = String(rawToken || "");
  if (/^[-_]/.test(token) || /[-_]$/.test(token)) return true;
  if (/(.)\1\1/.test(norm)) return true; // aaa, bbb -> oft OCR/Fragment
  const vowels = (norm.match(/[aeiouy]/g) || []).length;
  const vowelRatio = vowels / Math.max(1, norm.length);
  if (vowelRatio < 0.2) return true;
  if (/[bcdfghjklmnpqrstvwxyz]{4,}/.test(norm)) return true;
  return false;
}

function _editDistance(a, b) {
  const s = String(a || "");
  const t = String(b || "");
  if (!s) return t.length;
  if (!t) return s.length;
  const dp = Array.from({ length: s.length + 1 }, () => new Array(t.length + 1).fill(0));
  for (let i = 0; i <= s.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= t.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= s.length; i += 1) {
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[s.length][t.length];
}

function _buildKnownDictionaryIndex(db) {
  const rows = db.prepare(`SELECT norm_key, term, variants_json FROM dictionary_terms`).all();
  const normSet = new Set();
  const normList = [];
  for (const row of rows || []) {
    const base = _normalizeDictionaryTerm(row?.term || row?.norm_key || "");
    if (base) {
      if (!normSet.has(base)) normList.push(base);
      normSet.add(base);
    }
    try {
      const vars = JSON.parse(row?.variants_json || "[]");
      if (Array.isArray(vars)) {
        for (const v of vars) {
          const n = _normalizeDictionaryTerm(v);
          if (!n) continue;
          if (!normSet.has(n)) normList.push(n);
          normSet.add(n);
        }
      }
    } catch {
      // ignore
    }
  }
  return { normSet, normList };
}

function _isNearKnownTerm(normKey, knownIndex) {
  if (!normKey) return false;
  const { normSet, normList } = knownIndex || {};
  if (normSet?.has(normKey)) return true;
  for (const known of normList || []) {
    if (!known) continue;
    if (normKey.startsWith(known) && known.length >= 5) return true;
    if (known.startsWith(normKey) && normKey.length >= 5) return true;
    const lenDiff = Math.abs(normKey.length - known.length);
    if (lenDiff > 2 && normKey.length > 10) continue;
    const maxDist = normKey.length <= 7 ? 1 : 2;
    if (_editDistance(normKey, known) <= maxDist) return true;
  }
  return false;
}

function _listDictionaryFiles(rootDir) {
  const files = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const name = entry.name || "";
      if (!name) continue;
      const fullPath = path.join(current, name);
      if (entry.isDirectory()) {
        if (DICTIONARY_IGNORE_DIRS.has(name)) continue;
        if (name.startsWith(".")) continue;
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(name).toLowerCase();
      if (!DICTIONARY_ALLOWED_EXTENSIONS.has(ext)) continue;
      let size = 0;
      try {
        size = fs.statSync(fullPath).size;
      } catch {
        continue;
      }
      if (size > DICTIONARY_MAX_FILE_SIZE) continue;
      files.push(fullPath);
    }
  }
  files.sort((a, b) => a.localeCompare(b));
  return files;
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
        "email_subject",
        "email_body",
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
        "print.preRemarks.enabled",
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
        "print.v2.footerReserveMm",
        "dbMigrationPromptDismissed",
        "tops.titleMax",
        "tops.longMax",
        "tops.level1Collapsed",
        "tops.showLongtextInList",
        "tops.fontscale.list",
        "tops.fontscale.editbox",
        "audio.whisper.quality",
        "trial.enabled",
        "trial.daysLimit",
        "trial.firstStartAt",
      ]);
      const allowedPrefixes = ["defaults.", "meta.touched."];
      const data = {};

      for (const [k, v] of Object.entries(payload)) {
        const key = (k || "").toString().trim();
        const isPrefixAllowed = allowedPrefixes.some((prefix) => key.startsWith(prefix));
        if (!allowed.has(key) && !isPrefixAllowed) continue;
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

  ipcMain.handle("dictionary:listFiles", async (_evt, payload) => {
    try {
      const dirPath = String(payload?.dirPath || "").trim();
      if (!dirPath) return { ok: false, error: "dirPath fehlt" };
      if (!fs.existsSync(dirPath)) return { ok: false, error: "Ordner nicht gefunden" };
      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) return { ok: false, error: "Pfad ist kein Ordner" };
      const files = _listDictionaryFiles(dirPath);
      return { ok: true, files, totalCount: files.length };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dictionary:extractTermsFromFile", async (_evt, payload) => {
    try {
      const filePath = String(payload?.filePath || "").trim();
      if (!filePath) return { ok: false, error: "filePath fehlt" };
      if (!fs.existsSync(filePath)) return { ok: false, error: "Datei nicht gefunden" };
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return { ok: false, error: "Pfad ist keine Datei" };
      if (stat.size > DICTIONARY_MAX_FILE_SIZE) {
        return { ok: false, error: "Datei ist zu groß" };
      }
      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".pdf") {
        const pdfRes = await _extractPdfText(filePath);
        if (!pdfRes.ok) return { ok: false, error: pdfRes.error || "PDF konnte nicht gelesen werden." };
        const cleaned = _cleanPdfText(pdfRes.text || "");
        if (!cleaned) {
          return { ok: true, filePath, terms: [], note: "pdf_no_text" };
        }
        const terms = _extractDictionaryTermsFromText(cleaned);
        if (!terms.length) {
          return { ok: true, filePath, terms: [], note: "no_terms" };
        }
        return { ok: true, filePath, terms };
      }

      const buffer = fs.readFileSync(filePath);
      if (!_isLikelyTextBuffer(buffer)) {
        return { ok: false, error: "Keine Textdatei" };
      }
      const text = buffer.toString("utf8");
      const terms = _extractDictionaryTermsFromText(text);
      if (!terms.length) return { ok: true, filePath, terms: [], note: "no_terms" };
      return { ok: true, filePath, terms };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dictionary:applyScanResults", async (_evt, payload) => {
    try {
      const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
      const db = initDatabase();
      const knownIndex = _buildKnownDictionaryIndex(db);
      const now = new Date().toISOString();
      const selectStmt = db.prepare(
        "SELECT norm_key, term, variants_json, frequency, status, source_path, source_excerpt FROM dictionary_suggestions WHERE norm_key = ?"
      );
      const insertStmt = db.prepare(`
        INSERT INTO dictionary_suggestions
          (norm_key, term, variants_json, frequency, source_path, source_excerpt, status, created_at, updated_at)
        VALUES
          (@norm_key, @term, @variants_json, @frequency, @source_path, @source_excerpt, @status, @created_at, @updated_at)
      `);
      const updateStmt = db.prepare(`
        UPDATE dictionary_suggestions
        SET term=@term, variants_json=@variants_json, frequency=@frequency, source_path=@source_path,
            source_excerpt=@source_excerpt, status=@status, updated_at=@updated_at
        WHERE norm_key=@norm_key
      `);

      const tx = db.transaction(() => {
        for (const item of suggestions) {
          const normKey = String(item?.normKey || "").trim();
          if (!normKey) continue;
          const term = String(item?.term || "").trim() || normKey;
          if (DICTIONARY_STOPWORDS.has(normKey) || DICTIONARY_COMMON_WORDS.has(normKey)) continue;
          if (_isLikelyFragmentToken(normKey, term)) continue;
          if (_isNearKnownTerm(normKey, knownIndex)) continue;
          const variants = Array.isArray(item?.variants) ? item.variants.map((v) => String(v || "").trim()).filter(Boolean) : [];
          const frequency = Number(item?.frequency || 0);
          const sourcePath = String(item?.sourcePath || "").trim();
          const sourceExcerpt = String(item?.sourceExcerpt || "").trim();
          const existing = selectStmt.get(normKey);

          if (!existing) {
            insertStmt.run({
              norm_key: normKey,
              term,
              variants_json: JSON.stringify(Array.from(new Set(variants))),
              frequency: Number.isFinite(frequency) && frequency > 0 ? Math.floor(frequency) : 0,
              source_path: sourcePath,
              source_excerpt: sourceExcerpt,
              status: "pending",
              created_at: now,
              updated_at: now,
            });
            continue;
          }

          let existingVariants = [];
          try {
            const parsed = JSON.parse(existing.variants_json || "[]");
            if (Array.isArray(parsed)) existingVariants = parsed;
          } catch {
            existingVariants = [];
          }
          const mergedVariants = Array.from(new Set([...existingVariants, ...variants])).slice(0, 12);
          const mergedFrequency = Math.max(0, Number(existing.frequency || 0)) + (Number.isFinite(frequency) ? Math.max(0, Math.floor(frequency)) : 0);
          const nextStatus = String(existing.status || "pending").trim() || "pending";
          updateStmt.run({
            norm_key: normKey,
            term: existing.term || term,
            variants_json: JSON.stringify(mergedVariants),
            frequency: mergedFrequency,
            source_path: existing.source_path || sourcePath,
            source_excerpt: existing.source_excerpt || sourceExcerpt,
            status: nextStatus,
            updated_at: now,
          });
        }
      });
      tx();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dictionary:listSuggestions", async () => {
    try {
      const db = initDatabase();
      const rows = db.prepare(`
        SELECT norm_key, term, variants_json, frequency, source_path, source_excerpt, status, created_at, updated_at
        FROM dictionary_suggestions
        ORDER BY
          CASE status
            WHEN 'pending' THEN 0
            WHEN 'deferred' THEN 1
            WHEN 'accepted' THEN 2
            WHEN 'rejected' THEN 3
            ELSE 4
          END,
          LENGTH(term) DESC,
          frequency DESC,
          term ASC
      `).all();
      return { ok: true, suggestions: rows || [] };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dictionary:updateSuggestionStatus", async (_evt, payload) => {
    try {
      const normKey = String(payload?.normKey || "").trim();
      const status = String(payload?.status || "").trim().toLowerCase();
      const allowed = new Set(["pending", "accepted", "rejected", "deferred"]);
      if (!normKey) return { ok: false, error: "normKey fehlt" };
      if (!allowed.has(status)) return { ok: false, error: "Status ungueltig" };
      const db = initDatabase();
      const now = new Date().toISOString();
      const suggestion = db.prepare(
        "SELECT norm_key, term, variants_json, status FROM dictionary_suggestions WHERE norm_key = ?"
      ).get(normKey);
      if (!suggestion) return { ok: false, error: "Vorschlag nicht gefunden" };

      if (status === "accepted") {
        const termRow = db.prepare(
          "SELECT norm_key, variants_json FROM dictionary_terms WHERE norm_key = ?"
        ).get(normKey);
        let mergedVariants = [];
        let suggestionVariants = [];
        try {
          const parsed = JSON.parse(suggestion.variants_json || "[]");
          if (Array.isArray(parsed)) suggestionVariants = parsed;
        } catch {
          suggestionVariants = [];
        }
        if (termRow) {
          let existingVariants = [];
          try {
            const parsed = JSON.parse(termRow.variants_json || "[]");
            if (Array.isArray(parsed)) existingVariants = parsed;
          } catch {
            existingVariants = [];
          }
          mergedVariants = Array.from(new Set([...existingVariants, ...suggestionVariants])).slice(0, 12);
          db.prepare(`
            UPDATE dictionary_terms
            SET term=?, variants_json=?, is_active=1, updated_at=?
            WHERE norm_key=?
          `).run(suggestion.term, JSON.stringify(mergedVariants), now, normKey);
        } else {
          mergedVariants = Array.from(new Set([...suggestionVariants])).slice(0, 12);
          db.prepare(`
            INSERT INTO dictionary_terms
              (norm_key, term, variants_json, is_active, created_at, updated_at)
            VALUES
              (?, ?, ?, 1, ?, ?)
          `).run(normKey, suggestion.term, JSON.stringify(mergedVariants), now, now);
        }
      }

      db.prepare(`
        UPDATE dictionary_suggestions
        SET status=?, updated_at=?
        WHERE norm_key=?
      `).run(status, now, normKey);

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dictionary:listTerms", async () => {
    try {
      const db = initDatabase();
      const rows = db.prepare(`
        SELECT norm_key, term, variants_json, is_active, created_at, updated_at
        FROM dictionary_terms
        ORDER BY term ASC
      `).all();
      return { ok: true, terms: rows || [] };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dictionary:setTermActive", async (_evt, payload) => {
    try {
      const normKey = String(payload?.normKey || "").trim();
      const isActive = payload?.isActive ? 1 : 0;
      if (!normKey) return { ok: false, error: "normKey fehlt" };
      const db = initDatabase();
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE dictionary_terms
        SET is_active=?, updated_at=?
        WHERE norm_key=?
      `).run(isActive, now, normKey);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("dictionary:deleteTerm", async (_evt, payload) => {
    try {
      const normKey = String(payload?.normKey || "").trim();
      if (!normKey) return { ok: false, error: "normKey fehlt" };
      const db = initDatabase();
      db.prepare("DELETE FROM dictionary_terms WHERE norm_key=?").run(normKey);
      return { ok: true };
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
