// TECH-CONTRACT (verbindlich): docs/UI-TECH-CONTRACT.md
// CONTRACT-VERSION: 1.0.0
// src/main/ipc/topsIpc.js

const { ipcMain } = require("electron");
const fs = require("fs");

const topsRepo = require("../db/topsRepo");
const meetingsRepo = require("../db/meetingsRepo");
const meetingTopsRepo = require("../db/meetingTopsRepo");

const firmsRepo = require("../db/firmsRepo");
const personsRepo = require("../db/personsRepo");
const projectFirmsRepo = require("../db/projectFirmsRepo");
const projectPersonsRepo = require("../db/projectPersonsRepo");
const { appSettingsGetMany } = require("../db/appSettingsRepo");
const { initDatabase } = require("../db/database");

const { createTopService } = require("../domain/TopService");
const { createFirmService } = require("../domain/FirmService");
const { createPersonService } = require("../domain/PersonService");

const DEFAULT_FIRM_ROLE_ORDER = [10, 20, 30, 40, 50, 60];

function _getFirmRoleOrder() {
  try {
    const data = appSettingsGetMany(["firm_role_order"]);
    const raw = data?.firm_role_order || "";
    let parsed = [];
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) parsed = arr;
    } catch {
      parsed = [];
    }

    const out = [];
    const seen = new Set();
    for (const v of parsed) {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      if (seen.has(n)) continue;
      out.push(n);
      seen.add(n);
    }
    for (const n of DEFAULT_FIRM_ROLE_ORDER) {
      if (seen.has(n)) continue;
      out.push(n);
      seen.add(n);
    }
    return out;
  } catch {
    return [...DEFAULT_FIRM_ROLE_ORDER];
  }
}

function _sortFirmsByRoleOrder(list, roleOrder) {
  const order = Array.isArray(roleOrder) ? roleOrder : DEFAULT_FIRM_ROLE_ORDER;
  const pos = new Map(order.map((c, i) => [c, i]));
  const len = order.length;

  const norm = (v) => (v == null ? "" : String(v)).toLowerCase();
  const roleCode = (item) => {
    const n = Number(item?.role_code);
    return Number.isFinite(n) ? n : 60;
  };

  const out = Array.isArray(list) ? [...list] : [];
  out.sort((a, b) => {
    const ai = pos.has(roleCode(a)) ? pos.get(roleCode(a)) : len;
    const bi = pos.has(roleCode(b)) ? pos.get(roleCode(b)) : len;
    if (ai !== bi) return ai - bi;

    const an = norm(a?.name);
    const bn = norm(b?.name);
    if (an < bn) return -1;
    if (an > bn) return 1;

    const as = norm(a?.short);
    const bs = norm(b?.short);
    if (as < bs) return -1;
    if (as > bs) return 1;

    return 0;
  });

  return out;
}

function _normStr(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function _cleanupGlobalPersonLinks(personId) {
  if (!personId) return { openMeetingsRemoved: 0, poolRemoved: 0 };
  const db = initDatabase();

  const delOpen = db
    .prepare(
      `
      DELETE FROM meeting_participants
      WHERE kind = 'global_person'
        AND person_id = ?
        AND meeting_id IN (
          SELECT id
          FROM meetings
          WHERE is_closed = 0
        )
    `
    )
    .run(String(personId));

  const delPool = db
    .prepare(
      `
      DELETE FROM project_candidates
      WHERE kind = 'global_person'
        AND person_id = ?
    `
    )
    .run(String(personId));

  return {
    openMeetingsRemoved: Number(delOpen?.changes || 0),
    poolRemoved: Number(delPool?.changes || 0),
  };
}

function _resolveImportTarget(payload) {
  const raw = _normStr(payload?.context || payload?.target).toLocaleLowerCase("de-DE");
  if (raw === "projekt" || raw === "project") return "project";
  return "stamm";
}

function _requireProjectId(payload) {
  const projectId = _normStr(payload?.projectId);
  if (!projectId) throw new Error("projectId fehlt");
  return projectId;
}

function _getPersonImportFirmId(payload) {
  return _normStr(payload?.personImportFirmId ?? payload?.projectFirmId ?? payload?.firmId);
}

function _resolveBoundPersonImportFirm(payload) {
  const target = _resolveImportTarget(payload);
  const firmId = _getPersonImportFirmId(payload);
  if (!firmId) return null;

  if (target === "project") {
    const projectId = _requireProjectId(payload);
    const firm = projectFirmsRepo.getById(firmId);
    if (!firm || _normStr(firm?.project_id) !== projectId || _normStr(firm?.removed_at)) {
      throw new Error("Projektfirma fehlt");
    }
    return {
      id: _normStr(firm.id),
      name: _normStr(firm.name || firm.short),
    };
  }

  const firm = firmsRepo.listActive().find((row) => _normStr(row?.id) === firmId) || null;
  if (!firm) throw new Error("Firma fehlt");
  return {
    id: _normStr(firm.id),
    name: _normStr(firm.name || firm.short),
  };
}

function _normKey(v) {
  return _normStr(v)
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[:]/g, "")
    .trim();
}

function _firstNonEmpty(values) {
  for (const v of values || []) {
    const s = _normStr(v);
    if (s) return s;
  }
  return "";
}

function _getField(row, keys) {
  if (!row || !row.__fields) return "";
  for (const k of keys || []) {
    const hit = row.__fields.get(_normKey(k));
    if (_normStr(hit)) return _normStr(hit);
  }
  return "";
}

function _detectDelimiterFromHeaderLine(line) {
  const s = String(line || "");
  let comma = 0;
  let semicolon = 0;
  let inQuotes = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === '"') {
      if (inQuotes && s[i + 1] === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (inQuotes) continue;
    if (ch === ",") comma += 1;
    if (ch === ";") semicolon += 1;
  }
  return semicolon > comma ? ";" : ",";
}

function _parseCsvText(csvText, delimiter) {
  const text = String(csvText || "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function _parseStreetBlock(streetRaw) {
  const raw = String(streetRaw || "");
  if (!raw.trim()) return { street: "", zip: "", city: "", addressRaw: "" };

  const hasMulti = /[\r\n]/.test(raw);
  if (!hasMulti) {
    return { street: raw.trim(), zip: "", city: "", addressRaw: "" };
  }

  const lines = raw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => !!x);

  const addressRaw = lines.join("\n");
  if (lines.length === 0) return { street: "", zip: "", city: "", addressRaw };

  let zip = "";
  let city = "";
  let zipLineIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = /\b(\d{5})\b/.exec(line);
    if (!m) continue;
    zip = m[1] || "";
    zipLineIndex = i;
    const rest = line.slice((m.index || 0) + m[0].length).trim();
    city = rest || "";
    break;
  }

  let street = "";
  const withNumber = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (i === zipLineIndex) continue;
    if (/\d/.test(lines[i])) withNumber.push(lines[i]);
  }
  if (withNumber.length > 0) {
    street = withNumber[withNumber.length - 1];
  } else {
    street = lines[lines.length - 1] || "";
  }

  return { street: street.trim(), zip: zip.trim(), city: city.trim(), addressRaw };
}

function _buildOutlookStagingFromRows(parsedRows, existingFirms) {
  const companyKeys = ["Firma", "Company"];
  const streetKeys = ["Straße geschäftlich", "Business Street", "Straße privat", "Home Street"];
  const zipKeys = ["PLZ geschäftlich", "Business Postal Code", "PLZ privat", "Home Postal Code"];
  const cityKeys = ["Ort geschäftlich", "Business City", "Ort privat", "Home City"];
  const phoneKeys = [
    "Telefon geschäftlich",
    "Business Phone",
    "Telefon (privat)",
    "Home Phone",
    "Mobiltelefon",
    "Mobile Phone",
  ];
  const emailKeys = [
    "E-Mail-Adresse",
    "E-mail Address",
    "E-Mail 2: Adresse",
    "E-mail 2 Address",
    "E-Mail 3: Adresse",
    "E-mail 3 Address",
  ];

  const groups = new Map();
  let ignoredWithoutCompany = 0;

  for (const row of parsedRows || []) {
    const company = _getField(row, companyKeys);
    if (!company) {
      ignoredWithoutCompany += 1;
      continue;
    }
    const key = company.toLocaleLowerCase("de-DE");
    if (!groups.has(key)) {
      groups.set(key, { name: company, rows: [] });
    }
    groups.get(key).rows.push(row);
  }

  const existingSet = new Set(
    (existingFirms || [])
      .map((f) => _normStr(f?.name).toLocaleLowerCase("de-DE"))
      .filter((x) => !!x)
  );

  const staging = [];

  for (const group of groups.values()) {
    const candidatesStreet = [];
    const candidatesZip = [];
    const candidatesCity = [];
    const candidatesPhone = [];
    const candidatesEmail = [];
    const rawBlocks = [];

    for (const row of group.rows) {
      const streetRaw = _getField(row, streetKeys);
      if (streetRaw) {
        candidatesStreet.push(streetRaw);
        if (/[\r\n]/.test(streetRaw)) rawBlocks.push(streetRaw);
      }
      const zipRaw = _getField(row, zipKeys);
      if (zipRaw) candidatesZip.push(zipRaw);
      const cityRaw = _getField(row, cityKeys);
      if (cityRaw) candidatesCity.push(cityRaw);
      const phoneRaw = _getField(row, phoneKeys);
      if (phoneRaw) candidatesPhone.push(phoneRaw);
      const emailRaw = _getField(row, emailKeys);
      if (emailRaw) candidatesEmail.push(emailRaw);
    }

    const streetFirst = _firstNonEmpty(candidatesStreet);
    const parsedStreet = _parseStreetBlock(streetFirst);

    const zip = _firstNonEmpty([_firstNonEmpty(candidatesZip), parsedStreet.zip]);
    const city = _firstNonEmpty([_firstNonEmpty(candidatesCity), parsedStreet.city]);
    const addressRaw = _firstNonEmpty([parsedStreet.addressRaw, rawBlocks.join("\n\n").trim()]);

    const statusBase = existingSet.has(group.name.toLocaleLowerCase("de-DE")) ? "Existiert" : "Neu";
    staging.push({
      row_id: `imp_${staging.length + 1}`,
      take: 1,
      company_contacts_count: group.rows.length,
      short: "",
      name1: group.name,
      name2: "",
      street: parsedStreet.street || streetFirst,
      zip,
      city,
      phone: _firstNonEmpty(candidatesPhone),
      email: _firstNonEmpty(candidatesEmail),
      gewerk: "",
      notes: "",
      address_raw: addressRaw,
      status_base: statusBase,
    });
  }

  staging.sort((a, b) => {
    const an = _normStr(a?.name1).toLocaleLowerCase("de-DE");
    const bn = _normStr(b?.name1).toLocaleLowerCase("de-DE");
    if (an < bn) return -1;
    if (an > bn) return 1;
    return 0;
  });

  return { staging, ignoredWithoutCompany };
}

function _joinNonEmpty(parts, sep = "\n") {
  return (parts || [])
    .map((x) => _normStr(x))
    .filter((x) => !!x)
    .join(sep);
}

function _buildPersonRawText(row) {
  if (!row || !row.__fields) return "";
  const parts = [];
  for (const [k, v] of row.__fields.entries()) {
    const key = _normStr(k);
    const val = _normStr(v);
    if (!key || !val) continue;
    parts.push(`${key}: ${val}`);
  }
  return parts.join("\n");
}

function _buildPersonImportKeys(row) {
  const firmId = _normStr(row?.firm_id);
  if (!firmId) return { byEmail: "", byName: "" };

  const email = _normStr(row?.email).toLocaleLowerCase("de-DE");
  const first = _normStr(row?.first_name).toLocaleLowerCase("de-DE");
  const last = _normStr(row?.last_name).toLocaleLowerCase("de-DE");

  const byEmail = email ? `${firmId}::email::${email}` : "";
  const byName = first || last ? `${firmId}::name::${first}::${last}` : "";
  return { byEmail, byName };
}

function _buildPersonExistingSnapshot(row) {
  if (!row) return null;
  return {
    id: _normStr(row?.id),
    first_name: _normStr(row?.first_name),
    last_name: _normStr(row?.last_name),
    email: _normStr(row?.email).toLocaleLowerCase("de-DE"),
    phone: _normStr(row?.phone),
    funktion: _normStr(row?.funktion),
    rolle: _normStr(row?.rolle),
    notes: _normStr(row?.notes),
  };
}

function _buildPersonsStagingFromRows(parsedRows, firms, existingPersons) {
  const firstNameKeys = ["Vorname", "First Name"];
  const lastNameKeys = ["Nachname", "Last Name"];
  const companyKeys = ["Firma", "Company"];
  const emailKeys = [
    "E-Mail-Adresse",
    "E-mail Address",
    "E-Mail 2: Adresse",
    "E-mail 2 Address",
    "E-Mail 3: Adresse",
    "E-mail 3 Address",
  ];
  const phoneKeys = [
    "Telefon geschäftlich",
    "Business Phone",
    "Telefon (privat)",
    "Home Phone",
    "Mobiltelefon",
    "Mobile Phone",
  ];
  const notesKeys = ["Notizen", "Notes"];

  const firmNameToFirms = new Map();
  for (const f of firms || []) {
    const key = _normStr(f?.name).toLocaleLowerCase("de-DE");
    if (!key) continue;
    if (!firmNameToFirms.has(key)) {
      firmNameToFirms.set(key, []);
    }
    firmNameToFirms.get(key).push({ id: f.id, name: _normStr(f.name) });
  }

  const byEmail = new Map();
  const byName = new Map();
  for (const p of existingPersons || []) {
    const keys = _buildPersonImportKeys({
      firm_id: p?.firm_id,
      email: p?.email,
      first_name: p?.first_name,
      last_name: p?.last_name,
    });
    if (keys.byEmail && !byEmail.has(keys.byEmail)) byEmail.set(keys.byEmail, p);
    if (keys.byName && !byName.has(keys.byName)) byName.set(keys.byName, p);
  }

  const items = [];
  let missingFirm = 0;
  let ambiguousFirm = 0;
  let missingName = 0;
  let duplicateCount = 0;

  for (const row of parsedRows || []) {
    const companyName = _getField(row, companyKeys);
    const firstName = _normStr(_getField(row, firstNameKeys));
    const lastName = _normStr(_getField(row, lastNameKeys));
    const email = _normStr(_getField(row, emailKeys)).toLocaleLowerCase("de-DE");
    const phone = _normStr(_getField(row, phoneKeys));
    const funktion = _joinNonEmpty([
      _getField(row, ["Position", "Job Title"]),
      _getField(row, ["Abteilung", "Department"]),
    ], " | ");
    const notes = _getField(row, notesKeys);

    const firmKey = _normStr(companyName).toLocaleLowerCase("de-DE");
    const firmCandidates = firmKey ? firmNameToFirms.get(firmKey) || [] : [];
    const firmAmbiguous = firmCandidates.length > 1;
    const firm = firmCandidates.length === 1 ? firmCandidates[0] : null;
    const firmId = firm?.id || "";
    const hasName = !!firstName || !!lastName;

    if (!firmId) {
      missingFirm += 1;
      if (firmAmbiguous) ambiguousFirm += 1;
    }
    if (!hasName) missingName += 1;

    const keys = _buildPersonImportKeys({
      firm_id: firmId,
      email,
      first_name: firstName,
      last_name: lastName,
    });

    let existingMatch = null;
    let matchMode = "";
    if (keys.byEmail && byEmail.has(keys.byEmail)) {
      existingMatch = byEmail.get(keys.byEmail) || null;
      matchMode = "email";
    } else if (keys.byName && byName.has(keys.byName)) {
      existingMatch = byName.get(keys.byName) || null;
      matchMode = "name";
    }

    let statusBase = "Neu";
    if (!firmId) {
      statusBase = firmAmbiguous ? "Firma ungeklärt" : "Firma fehlt";
    } else if (existingMatch) {
      statusBase = "Existiert";
      duplicateCount += 1;
    }

    const take = firmId && hasName ? 1 : 0;

    items.push({
      row_id: `person_imp_${items.length + 1}`,
      take,
      firm_id: firmId,
      firm_name: firm?.name || _normStr(companyName),
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      funktion,
      rolle: "",
      notes,
      status_base: statusBase,
      match_mode: matchMode,
      existing_person_id: _normStr(existingMatch?.id),
      existing_person: _buildPersonExistingSnapshot(existingMatch),
      conflict_state: existingMatch ? "needs_decision" : "none",
      conflict_action: "",
      raw_data: _buildPersonRawText(row),
      dirty_fields: {},
    });
  }

  return { items, missingFirm, ambiguousFirm, missingName, duplicateCount };
}

function _bindPersonsStagingToFirm(items, firm, existingPersons) {
  if (!firm?.id) {
    return { items: Array.isArray(items) ? items : [], missingFirm: 0, ambiguousFirm: 0, missingName: 0, duplicateCount: 0 };
  }

  const byEmail = new Map();
  const byName = new Map();
  for (const p of existingPersons || []) {
    const keys = _buildPersonImportKeys({
      firm_id: firm.id,
      email: p?.email,
      first_name: p?.first_name,
      last_name: p?.last_name,
    });
    if (keys.byEmail && !byEmail.has(keys.byEmail)) byEmail.set(keys.byEmail, p);
    if (keys.byName && !byName.has(keys.byName)) byName.set(keys.byName, p);
  }

  let missingName = 0;
  let duplicateCount = 0;
  const out = [];

  for (const item of items || []) {
    const firstName = _normStr(item?.first_name);
    const lastName = _normStr(item?.last_name);
    const email = _normStr(item?.email).toLocaleLowerCase("de-DE");
    const hasName = !!firstName || !!lastName;
    if (!hasName) missingName += 1;

    const keys = _buildPersonImportKeys({
      firm_id: firm.id,
      email,
      first_name: firstName,
      last_name: lastName,
    });

    let existingMatch = null;
    let matchMode = "";
    if (keys.byEmail && byEmail.has(keys.byEmail)) {
      existingMatch = byEmail.get(keys.byEmail) || null;
      matchMode = "email";
    } else if (keys.byName && byName.has(keys.byName)) {
      existingMatch = byName.get(keys.byName) || null;
      matchMode = "name";
    }

    if (existingMatch) duplicateCount += 1;

    out.push({
      ...item,
      take: hasName ? 1 : 0,
      firm_id: firm.id,
      firm_name: firm.name || "",
      status_base: existingMatch ? "Existiert" : "Neu",
      match_mode: matchMode,
      existing_person_id: _normStr(existingMatch?.id),
      existing_person: _buildPersonExistingSnapshot(existingMatch),
      conflict_state: existingMatch ? "needs_decision" : "none",
      conflict_action: "",
    });
  }

  return { items: out, missingFirm: 0, ambiguousFirm: 0, missingName, duplicateCount };
}

const PERSON_IMPORT_OVERWRITE_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "funktion",
  "rolle",
  "notes",
];

function _normalizeConflictAction(v) {
  const raw = _normStr(v).toLocaleLowerCase("de-DE");
  if (raw === "overwrite") return "overwrite";
  if (raw === "skip") return "skip";
  return "";
}

function _isConflictItem(item) {
  const conflictState = _normStr(item?.conflict_state).toLocaleLowerCase("de-DE");
  if (conflictState === "needs_decision") return true;
  const existingId = _normStr(item?.existing_person_id);
  if (existingId) return true;
  const base = _normStr(item?.status_base).toLocaleLowerCase("de-DE");
  return base.includes("exist") || base.includes("vorhanden");
}

function _cleanPersonsImportItems(items, { strictDecision = true, skipConflicts = false } = {}) {
  const list = Array.isArray(items) ? items : [];
  const cleaned = [];
  let forcedSkippedConflicts = 0;
  let unresolvedConflicts = 0;

  for (const x of list) {
    let take = Number(x?.take ?? 0) === 1 ? 1 : 0;
    const isConflict = _isConflictItem(x);
    const conflictAction = _normalizeConflictAction(x?.conflict_action);
    const dirtyFromPayload =
      x?.dirty_fields && typeof x.dirty_fields === "object" ? { ...x.dirty_fields } : {};

    if (take === 1 && isConflict) {
      if (conflictAction === "skip" || (skipConflicts && !conflictAction)) {
        take = 0;
        forcedSkippedConflicts += 1;
      } else if (conflictAction === "overwrite") {
        for (const field of PERSON_IMPORT_OVERWRITE_FIELDS) {
          dirtyFromPayload[field] = 1;
        }
      } else if (strictDecision) {
        unresolvedConflicts += 1;
      }
    }

    cleaned.push({
      take,
      firm_id: _normStr(x?.firm_id),
      first_name: _normStr(x?.first_name),
      last_name: _normStr(x?.last_name),
      email: _normStr(x?.email).toLocaleLowerCase("de-DE"),
      phone: _normStr(x?.phone),
      funktion: _normStr(x?.funktion),
      rolle: _normStr(x?.rolle),
      notes: _normStr(x?.notes),
      dirty_fields: dirtyFromPayload,
    });
  }

  if (strictDecision && unresolvedConflicts > 0) {
    throw new Error(
      `Es gibt ${unresolvedConflicts} Dublette(n) ohne Entscheidung. Bitte je Kontakt "Überschreiben" oder "Nicht überschreiben" wählen.`
    );
  }

  return { cleaned, forcedSkippedConflicts };
}

function _loadCsvAndBuildRows(filePath) {
  const p = _normStr(filePath);
  if (!p) throw new Error("filePath fehlt");
  if (!fs.existsSync(p)) throw new Error("Datei nicht gefunden");

  let text = fs.readFileSync(p, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const firstLine = String(text.split(/\r?\n/, 1)[0] || "");
  const delimiter = _detectDelimiterFromHeaderLine(firstLine);
  const rawRows = _parseCsvText(text, delimiter);
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new Error("CSV ist leer");
  }

  const headers = (rawRows[0] || []).map((h) => _normStr(h));
  const hasHeader = headers.some((h) => !!h);
  if (!hasHeader) {
    throw new Error("CSV-Header fehlt");
  }

  const dataRows = [];
  for (let i = 1; i < rawRows.length; i += 1) {
    const row = rawRows[i] || [];
    const fields = new Map();
    for (let c = 0; c < headers.length; c += 1) {
      const hk = _normKey(headers[c]);
      if (!hk) continue;
      fields.set(hk, _normStr(row[c]));
    }
    const any = Array.from(fields.values()).some((v) => !!_normStr(v));
    if (!any) continue;
    dataRows.push({ __fields: fields });
  }

  return { headers, rows: dataRows, delimiter };
}

// ============================================================
// Display-Number Fix (Closed Meetings)
// ------------------------------------------------------------
// Problem: Seit PDF-Änderungen wird in GESCHLOSSENEN Besprechungen
// bei Unterpunkten oft nur noch die erste Stelle angezeigt (z.B. "1").
// Ursache: frozen_display_number kann falsch/zu grob sein (z.B. "1" für alle)
// und wurde bisher als "gültig" akzeptiert -> Hierarchie kollabiert.
//
// Fix: displayNumber robust normalisieren:
// - frozen_display_number NUR akzeptieren, wenn es zur Ebene passt
//   (hat Parent oder level>1 => muss mindestens "1.2" enthalten).
// - sonst aus Parent-Kette + number bauen.
// KEINE DB-Änderung, keine Business-Logik, nur Output stabilisieren.
// ============================================================
function normalizeDisplayNumbers(list, meeting) {
  const items = Array.isArray(list) ? list.map((x) => ({ ...x })) : [];
  const isClosed = Number(meeting?.is_closed) === 1;

  if (items.length === 0) return items;

  for (const t of items) {
    const pid =
      (isClosed ? t.frozen_parent_top_id : null) ??
      t.frozen_parentTopId ??
      t.parent_top_id ??
      t.parentTopId ??
      null;

    const num =
      (isClosed ? t.frozen_number : null) ??
      t.frozenNumber ??
      t.number ??
      null;

    const lvl =
      (isClosed ? t.frozen_level : null) ??
      t.frozenLevel ??
      t.level ??
      null;

    const pre =
      (isClosed ? t.frozen_display_number : null) ??
      t.frozen_displayNumber ??
      t.display_number ??
      t.displayNumber ??
      null;

    t.__pid = pid;
    t.__num = num;
    t.__lvl = lvl;
    t.__pre = typeof pre === "string" ? pre.trim() : pre;
  }

  const byId = new Map(items.map((t) => [t.id, t]));
  const memo = new Map();
  const visiting = new Set();

  const isHierString = (v) => {
    if (v === null || v === undefined) return false;
    const s = String(v).trim();
    if (!s) return false;
    return /^\d+(\.\d+)*$/.test(s);
  };

  // ✅ Wichtig: "1" ist NUR dann ok, wenn es wirklich Level-1 / ohne Parent ist.
  const isGoodHierForNode = (node, v) => {
    if (!isHierString(v)) return false;
    const s = String(v).trim();

    const hasParent = !!node.__pid;
    const lvl = Number(node.__lvl);
    const isChildByLevel = Number.isFinite(lvl) && lvl > 1;

    if (hasParent || isChildByLevel) {
      // Unterpunkt muss mindestens eine Hierarchie "1.2" haben
      return s.includes(".");
    }

    // Level-1 darf "1" sein
    return true;
  };

  const build = (id) => {
    if (!id) return null;
    if (memo.has(id)) return memo.get(id);

    const node = byId.get(id);
    if (!node) return null;

    if (visiting.has(id)) return null;
    visiting.add(id);

    // 1) Nur akzeptieren, wenn es zur Ebene passt
    if (isGoodHierForNode(node, node.__pre)) {
      const out = String(node.__pre).trim();
      memo.set(id, out);
      visiting.delete(id);
      return out;
    }

    // 2) Parent-Kette + number
    const n = node.__num;
    if (n === null || n === undefined || n === "") {
      memo.set(id, null);
      visiting.delete(id);
      return null;
    }

    const parentId = node.__pid;
    if (!parentId) {
      const out = String(n);
      memo.set(id, out);
      visiting.delete(id);
      return out;
    }

    const p = build(parentId);
    const out = p ? `${p}.${n}` : String(n);

    memo.set(id, out);
    visiting.delete(id);
    return out;
  };

  for (const t of items) {
    const node = byId.get(t.id) || t;
    const current = t.displayNumber ?? t.display_number ?? null;

    // Wenn current schon korrekt ist (und zur Ebene passt) -> lassen
    if (isGoodHierForNode(node, current)) {
      t.displayNumber = String(current).trim();
      continue;
    }

    const computed = build(t.id);
    if (computed) {
      t.displayNumber = computed;
    } else {
      const n = t.__num ?? t.number ?? null;
      t.displayNumber = n !== null && n !== undefined ? String(n) : "—";
    }
  }

  for (const t of items) {
    delete t.__pid;
    delete t.__num;
    delete t.__lvl;
    delete t.__pre;
  }

  return items;
}

function registerTopsIpc() {
  const topService = createTopService({ topsRepo, meetingsRepo, meetingTopsRepo });

  const firmService = createFirmService({ firmsRepo, personsRepo });
  const personService = createPersonService({ firmsRepo, personsRepo });

  ipcMain.handle("tops:listByMeeting", (_e, meetingId) => {
    try {
      const meeting = meetingsRepo.getMeetingById(meetingId);
      if (!meeting) throw new Error("Besprechung nicht gefunden");
      let todoSnapshot = null;
      let todoSnapshotError = null;
      const snapshotRaw = String(meeting?.todo_snapshot_json || "").trim();
      if (snapshotRaw) {
        try {
          todoSnapshot = JSON.parse(snapshotRaw);
        } catch (err) {
          const msg = err?.stack || err?.message || String(err);
          console.error("[topsIpc] todo snapshot parse failed", {
            meetingId,
            meeting_index: meeting?.meeting_index ?? null,
            error: msg,
          });
          todoSnapshotError = "ToDo-Snapshot konnte nicht gelesen werden.";
        }
      }

      const rawList = topService.listByMeeting(meetingId);

      // ✅ FIX: Hierarchie-Nummerierung auch bei geschlossenen Besprechungen stabil halten
      const list = normalizeDisplayNumbers(rawList, meeting);

      // ✅ DEBUG (Step): kommt "touched" beim Drucken in geschlossenen Meetings an?
      if (Number(meeting?.is_closed) === 1) {
        const touchedOld = (list || []).filter(
          (t) => Number(t?.is_carried_over) === 1 && Number(t?.is_touched) === 1
        );
        const sample = touchedOld[0] || null;

        console.log("[topsIpc] closed meeting touched-debug", {
          meetingId: meetingId,
          meeting_index: meeting?.meeting_index ?? null,
          total: (list || []).length,
          touched_old_count: touchedOld.length,
          sample: sample
            ? {
                id: sample.id,
                displayNumber: sample.displayNumber ?? sample.display_number ?? null,
                is_carried_over: sample.is_carried_over,
                is_touched: sample.is_touched,
                title: (sample.title || "").toString().slice(0, 60),
                longtext_len: sample.longtext ? String(sample.longtext).length : 0,
              }
            : null,
        });
      }

      return {
        ok: true,
        meeting: {
          id: meeting.id,
          project_id: meeting.project_id,
          meeting_index: meeting.meeting_index,
          title: meeting.title,
          is_closed: meeting.is_closed,
          pdf_show_ampel: meeting.pdf_show_ampel,
          todo_snapshot: todoSnapshot,
          todo_snapshot_error: todoSnapshotError,
          created_at: meeting.created_at,
          updated_at: meeting.updated_at,
        },
        list,
      };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("tops:listByProject", (_e, projectId) => {
    try {
      if (!projectId) throw new Error("Projekt nicht gefunden");

      const rawList = meetingTopsRepo.listLatestByProject(projectId);
      const list = normalizeDisplayNumbers(rawList, null);

      list.sort((a, b) => {
        const as = String(a.displayNumber || a.number || "").split(".").map((x) => Number(x));
        const bs = String(b.displayNumber || b.number || "").split(".").map((x) => Number(x));
        const n = Math.max(as.length, bs.length);

        for (let i = 0; i < n; i++) {
          const av = as[i] ?? -1;
          const bv = bs[i] ?? -1;
          if (av !== bv) return av - bv;
        }
        return 0;
      });

      return { ok: true, list };
    } catch (err) {
      const msg = err?.message || String(err);
      console.error("[topsIpc] listByProject failed", { projectId, error: msg });
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("tops:create", (_e, data) => {
    try {
      const created = topService.createTop(data);
      return { ok: true, top: created };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("tops:move", (_e, data) => {
    try {
      const moved = topService.moveTop(data);
      return { ok: true, top: moved };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("tops:delete", (_e, data) => {
    try {
      const res = topService.deleteTop({
        meetingId: data?.meetingId,
        topId: data?.topId,
      });
      return { ok: true, ...res };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("tops:markTrashed", (_e, data) => {
    try {
      const res = topsRepo.markTrashed({ topId: data?.topId });
      return { ok: true, ...res };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("tops:purgeTrashedByMeeting", (_e, data) => {
    try {
      const res = topsRepo.purgeTrashedByMeeting({ meetingId: data?.meetingId });
      return { ok: true, ...res };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("tops:purgeTrashedGlobal", () => {
    try {
      const res = topsRepo.purgeTrashedGlobal();
      return {
        ok: true,
        purgedCount: Number(res?.deleted || 0),
        ...res,
      };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("meetingTops:update", (_e, data) => {
    try {
      const mt = topService.updateMeetingFields({
        meetingId: data.meetingId,
        topId: data.topId,
        patch: data.patch,
      });

      // ✅ DEBUG (Step): beweisen, ob is_touched beim Speichern wirklich gesetzt wird
      console.log("[topsIpc] meetingTops:update", {
        meetingId: data?.meetingId ?? null,
        topId: data?.topId ?? null,
        patchKeys: Object.keys(data?.patch || {}),
        changed: mt?.changed ?? null,
        is_touched: mt?.row?.is_touched ?? null,
        is_carried_over: mt?.row?.is_carried_over ?? null,
      });

      return { ok: true, meetingTop: mt };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("meetingTops:fixNumberGap", (_e, data) => {
    try {
      const meetingId = data?.meetingId;
      const meeting = meetingsRepo.getMeetingById(meetingId);
      if (!meeting) return { ok: false, error: "Besprechung nicht gefunden" };
      if (Number(meeting.is_closed) === 1) {
        return {
          ok: false,
          errorCode: "READ_ONLY",
          error: "Besprechung ist geschlossen – Reparatur nicht erlaubt.",
        };
      }

      const res = topsRepo.fixNumberGap({
        meetingId,
        level: data?.level,
        parentTopId: data?.parentTopId ?? null,
        fromTopId: data?.fromTopId,
        toNumber: data?.toNumber,
      });

      if (res && res.ok === false) return res;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // ============================================================
  // GLOBAL Firmen
  // ============================================================

  ipcMain.handle("firms:listGlobal", () => {
    try {
      const list = firmService.listGlobal();
      const roleOrder = _getFirmRoleOrder();
      const sorted = _sortFirmsByRoleOrder(list, roleOrder);
      return { ok: true, list: sorted };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("firms:createGlobal", (_e, data) => {
    try {
      const firm = firmService.createGlobal(data);
      return { ok: true, firm };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("firms:updateGlobal", (_e, data) => {
    try {
      const firm = firmService.updateGlobal({
        firmId: data?.firmId,
        patch: data?.patch,
      });
      return { ok: true, firm };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("firms:deleteGlobal", (_e, firmId) => {
    try {
      const info = firmsRepo.markTrashed(firmId);
      return { ok: true, info };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("firms:markTrashed", (_e, data) => {
    try {
      const firmId = data?.firmId ?? data;
      const info = firmsRepo.markTrashed(firmId);
      return { ok: true, info };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("firms:purgeTrashedSafe", () => {
    try {
      const info = firmsRepo.purgeTrashedSafe();
      return { ok: true, info };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("firms:importParseCsv", (_e, payload) => {
    try {
      const filePath = payload?.filePath;
      const parsed = _loadCsvAndBuildRows(filePath);
      const target = _resolveImportTarget(payload);
      let existing = [];
      if (target === "project") {
        const projectId = _requireProjectId(payload);
        existing = projectFirmsRepo
          .listActiveByProject(projectId)
          .map((f) => ({ id: f.id, name: f.name }));
      } else {
        existing = firmsRepo.listActive().map((f) => ({ id: f.id, name: f.name }));
      }
      const ext = _buildOutlookStagingFromRows(parsed.rows, existing);
      return {
        ok: true,
        filePath: _normStr(filePath),
        delimiter: parsed.delimiter,
        rowsCount: parsed.rows.length,
        ignoredWithoutCompany: ext.ignoredWithoutCompany,
        items: ext.staging,
      };
    } catch (err) {
      console.error("[topsIpc] firms:importParseCsv failed", {
        filePath: payload?.filePath ?? null,
        error: err?.stack || err?.message || String(err),
      });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("firms:importApplyStaging", (_e, payload) => {
    try {
      const target = _resolveImportTarget(payload);
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const cleaned = items.map((x) => ({
        take: Number(x?.take ?? 0) === 1 ? 1 : 0,
        short: _normStr(x?.short),
        name1: _normStr(x?.name1),
        name2: _normStr(x?.name2),
        street: _normStr(x?.street),
        zip: _normStr(x?.zip),
        city: _normStr(x?.city),
        phone: _normStr(x?.phone),
        email: _normStr(x?.email),
        gewerk: _normStr(x?.gewerk),
        notes: _normStr(x?.notes),
        address_raw: _normStr(x?.address_raw),
      }));
      const summary =
        target === "project"
          ? projectFirmsRepo.importFromOutlookStaging({
              projectId: _requireProjectId(payload),
              stagingRows: cleaned,
            })
          : firmsRepo.importFromOutlookStaging(cleaned);

      let personsSummary = null;
      const includePersonsFromCsv = Number(payload?.includePersonsFromCsv ?? 0) === 1;
      const filePath = _normStr(payload?.filePath);
      if (includePersonsFromCsv && filePath) {
        const parsed = _loadCsvAndBuildRows(filePath);
        let firms = [];
        let existingPersons = [];
        if (target === "project") {
          const projectId = _requireProjectId(payload);
          firms = projectFirmsRepo.listActiveByProject(projectId).map((f) => ({ id: f.id, name: f.name }));
          existingPersons = projectPersonsRepo.listActiveByProject(projectId).map((p) => ({
            id: p.id,
            firm_id: p.project_firm_id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            phone: p.phone,
            funktion: p.funktion,
            rolle: p.rolle,
            notes: p.notes,
          }));
          const staging = _buildPersonsStagingFromRows(parsed.rows, firms, existingPersons);
          const prepared = _cleanPersonsImportItems(staging.items, {
            strictDecision: false,
            skipConflicts: true,
          });
          const personApplySummary = projectPersonsRepo.importPersonsFromOutlookStaging({
            projectId,
            stagingRows: prepared.cleaned,
          });
          personsSummary = {
            ...personApplySummary,
            rowsCount: parsed.rows.length,
            detected: staging.items.length,
            missingFirm: staging.missingFirm,
            ambiguousFirm: staging.ambiguousFirm,
            missingName: staging.missingName,
            duplicate: staging.duplicateCount,
            autoSkippedConflicts: prepared.forcedSkippedConflicts,
          };
        } else {
          firms = firmsRepo.listActive().map((f) => ({ id: f.id, name: f.name }));
          existingPersons = personsRepo.listActiveAll().map((p) => ({
            id: p.id,
            firm_id: p.firm_id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            phone: p.phone,
            funktion: p.funktion,
            rolle: p.rolle,
            notes: p.notes,
          }));
          const staging = _buildPersonsStagingFromRows(parsed.rows, firms, existingPersons);
          const prepared = _cleanPersonsImportItems(staging.items, {
            strictDecision: false,
            skipConflicts: true,
          });
          const personApplySummary = personsRepo.importPersonsFromOutlookStaging(prepared.cleaned);
          personsSummary = {
            ...personApplySummary,
            rowsCount: parsed.rows.length,
            detected: staging.items.length,
            missingFirm: staging.missingFirm,
            ambiguousFirm: staging.ambiguousFirm,
            missingName: staging.missingName,
            duplicate: staging.duplicateCount,
            autoSkippedConflicts: prepared.forcedSkippedConflicts,
          };
        }
      }

      return { ok: true, summary, personsSummary };
    } catch (err) {
      console.error("[topsIpc] firms:importApplyStaging failed", {
        error: err?.stack || err?.message || String(err),
      });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("persons:importParseCsv", (_e, payload) => {
    try {
      const filePath = payload?.filePath;
      const parsed = _loadCsvAndBuildRows(filePath);
      const target = _resolveImportTarget(payload);
      const boundFirm = _resolveBoundPersonImportFirm(payload);
      let firms = [];
      let existingPersons = [];
      if (target === "project") {
        const projectId = _requireProjectId(payload);
        if (boundFirm) {
          firms = [boundFirm];
          existingPersons = projectPersonsRepo.listActiveByProjectFirm(boundFirm.id).map((p) => ({
            id: p.id,
            firm_id: p.project_firm_id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            phone: p.phone,
            funktion: p.funktion,
            rolle: p.rolle,
            notes: p.notes,
          }));
        } else {
          firms = projectFirmsRepo.listActiveByProject(projectId).map((f) => ({ id: f.id, name: f.name }));
          existingPersons = projectPersonsRepo.listActiveByProject(projectId).map((p) => ({
            id: p.id,
            firm_id: p.project_firm_id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            phone: p.phone,
            funktion: p.funktion,
            rolle: p.rolle,
            notes: p.notes,
          }));
        }
      } else {
        if (boundFirm) {
          firms = [boundFirm];
          existingPersons = personsRepo.listActiveByFirm(boundFirm.id).map((p) => ({
            id: p.id,
            firm_id: p.firm_id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            phone: p.phone,
            funktion: p.funktion,
            rolle: p.rolle,
            notes: p.notes,
          }));
        } else {
          firms = firmsRepo.listActive().map((f) => ({ id: f.id, name: f.name }));
          existingPersons = personsRepo.listActiveAll().map((p) => ({
            id: p.id,
            firm_id: p.firm_id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            phone: p.phone,
            funktion: p.funktion,
            rolle: p.rolle,
            notes: p.notes,
          }));
        }
      }
      const stagingBase = _buildPersonsStagingFromRows(parsed.rows, firms, existingPersons);
      const staging = boundFirm
        ? _bindPersonsStagingToFirm(stagingBase.items, boundFirm, existingPersons)
        : stagingBase;
      return {
        ok: true,
        filePath: _normStr(filePath),
        delimiter: parsed.delimiter,
        rowsCount: parsed.rows.length,
        missingFirm: staging.missingFirm,
        ambiguousFirm: staging.ambiguousFirm,
        missingName: staging.missingName,
        duplicate: staging.duplicateCount,
        firms,
        items: staging.items,
      };
    } catch (err) {
      console.error("[topsIpc] persons:importParseCsv failed", {
        filePath: payload?.filePath ?? null,
        error: err?.stack || err?.message || String(err),
      });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("persons:importApplyStaging", (_e, payload) => {
    try {
      const target = _resolveImportTarget(payload);
      const boundFirm = _resolveBoundPersonImportFirm(payload);
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const prepared = _cleanPersonsImportItems(items, {
        strictDecision: true,
        skipConflicts: false,
      });
      const cleanedItems = boundFirm
        ? prepared.cleaned.map((item) => ({
            ...item,
            firm_id: boundFirm.id,
            firm_name: boundFirm.name || "",
          }))
        : prepared.cleaned;
      const summary =
        target === "project"
          ? projectPersonsRepo.importPersonsFromOutlookStaging({
              projectId: _requireProjectId(payload),
              stagingRows: cleanedItems,
            })
          : personsRepo.importPersonsFromOutlookStaging(cleanedItems);
      return { ok: true, summary };
    } catch (err) {
      console.error("[topsIpc] persons:importApplyStaging failed", {
        error: err?.stack || err?.message || String(err),
      });
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // ============================================================
  // GLOBAL Mitarbeiter (Persons) je Firma
  // ============================================================

  ipcMain.handle("persons:listByFirm", (_e, firmId) => {
    try {
      const list = personService.listByFirm(firmId);
      return { ok: true, list };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("persons:create", (_e, data) => {
    try {
      const person = personService.create(data);
      return { ok: true, person };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("persons:update", (_e, data) => {
    try {
      const person = personService.update({
        personId: data?.personId,
        patch: data?.patch,
      });
      return { ok: true, person };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("persons:delete", (_e, personId) => {
    try {
      const cleanup = _cleanupGlobalPersonLinks(personId);
      const info = personsRepo.markTrashed(personId);
      return { ok: true, info, cleanup };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("persons:markTrashed", (_e, data) => {
    try {
      const personId = data?.personId ?? data;
      const info = personsRepo.markTrashed(personId);
      return { ok: true, info };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("persons:purgeTrashedSafe", () => {
    try {
      const info = personsRepo.purgeTrashedSafe();
      return { ok: true, info };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  console.log("[main] tops IPC registered");
}

module.exports = { registerTopsIpc };
