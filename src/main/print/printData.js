// src/main/print/printData.js
const { initDatabase } = require("../db/database");
const projectsRepo = require("../db/projectsRepo");
const meetingsRepo = require("../db/meetingsRepo");
const projectSettingsRepo = require("../db/projectSettingsRepo");
const meetingTopsRepo = require("../db/meetingTopsRepo");
const projectFirmsRepo = require("../db/projectFirmsRepo");
const { appSettingsGetManyWithDb } = require("../db/appSettingsRepo");

function _parseBool(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  if (["1", "true", "yes", "ja", "on"].includes(s)) return true;
  return false;
}

function _clampNumber(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function _logoSizeToHeightMm(size) {
  const s = String(size || "").trim().toLowerCase();
  if (s === "small") return 22;
  if (s === "large") return 45;
  return 30;
}

function _docLabelForMode(mode) {
  const m = String(mode || "").trim();
  if (m === "preview" || m === "vorabzug") return "Vorabzug";
  if (m === "protocol") return "Protokoll";
  if (m === "topsAll") return "Top-Liste (alle)";
  if (m === "firms") return "Firmenliste";
  if (m === "todo") return "ToDo-Liste";
  if (m === "headerTest") return "Kopf-Test";
  return "Dokument";
}

function _resolvePrintProfile(mode) {
  const m = String(mode || "").trim();
  const documentLabel = _docLabelForMode(m);

  if (m === "preview" || m === "vorabzug") {
    return {
      key: "protocol_draft",
      parent: "protocol",
      family: "protocol",
      documentLabel,
      header: {
        titleMode: "protocolLine",
        showJourfix: true,
      },
      branding: {
        enabled: true,
        label: "Vorabzug",
      },
    };
  }

  if (m === "protocol" || m === "headerTest") {
    return {
      key: "protocol",
      parent: "base",
      family: "protocol",
      documentLabel,
      header: {
        titleMode: "protocolLine",
        showJourfix: true,
      },
      branding: {
        enabled: false,
        label: "",
      },
    };
  }

  if (m === "firms" || m === "todo" || m === "topsAll") {
    return {
      key: "list",
      parent: "base",
      family: "list",
      documentLabel,
      header: {
        titleMode: "documentLabel",
        showJourfix: false,
      },
      branding: {
        enabled: false,
        label: "",
      },
    };
  }

  return {
    key: "base",
    parent: null,
    family: "base",
    documentLabel,
    header: {
      titleMode: "baseTitle",
      showJourfix: false,
    },
    branding: {
      enabled: false,
      label: "",
    },
  };
}

function _normalizeLogoSize(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "small" || s === "medium" || s === "large") return s;
  return "medium";
}

function _normalizeLogoAlign(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "left" || s === "center" || s === "right") return s;
  return "center";
}

function _normalizeLogoVAlign(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "top" || s === "middle" || s === "bottom") return s;
  return "bottom";
}

function _normalizeTopNumber(row) {
  const n =
    row?.frozen_display_number ??
    row?.frozenDisplayNumber ??
    row?.displayNumber ??
    row?.display_number ??
    row?.number ??
    "";
  return String(n ?? "").trim();
}

function _isHierString(v) {
  const s = String(v || "").trim();
  if (!s) return false;
  return /^\d+(?:\.\d+)*$/.test(s);
}

function _isHiddenForPrint(t) {
  const hidden = Number(t?.is_hidden ?? t?.isHidden ?? 0) === 1;
  const frozenHidden = Number(t?.frozen_is_hidden ?? t?.frozenIsHidden ?? 0) === 1;
  return hidden || frozenHidden;
}

function _isRemovedFromPrint(t) {
  const trashed = Number(t?.is_trashed ?? t?.isTrashed ?? 0) === 1;
  const removed = !!(t?.removed_at ?? t?.removedAt);
  return trashed || removed;
}

function _applyPrintFlagsAndFilter(tops, { includeHidden = false } = {}) {
  const list = Array.isArray(tops) ? tops : [];
  return list.filter((t) => {
    t.isNewTop = Number(t?.is_carried_over ?? t?.isCarriedOver ?? 0) !== 1;
    t.isHiddenTop = _isHiddenForPrint(t);
    if (_isRemovedFromPrint(t)) return false;
    if (!includeHidden && t.isHiddenTop) return false;
    return true;
  });
}

function _parseHierSegments(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  if (!/^\d+(?:\.\d+)*$/.test(s)) return null;
  return s.split(".").map((x) => Number.parseInt(x, 10));
}

function _compareTopNumbers(a, b) {
  const aNum = a?.topNumberText ?? a?.display_number ?? _normalizeTopNumber(a);
  const bNum = b?.topNumberText ?? b?.display_number ?? _normalizeTopNumber(b);
  const aSeg = _parseHierSegments(aNum);
  const bSeg = _parseHierSegments(bNum);
  if (aSeg && bSeg) {
    const len = Math.max(aSeg.length, bSeg.length);
    for (let i = 0; i < len; i++) {
      const av = aSeg[i];
      const bv = bSeg[i];
      if (av == null && bv == null) break;
      if (av == null) return -1;
      if (bv == null) return 1;
      if (av !== bv) return av - bv;
    }
  } else if (aSeg && !bSeg) {
    return -1;
  } else if (!aSeg && bSeg) {
    return 1;
  } else {
    const as = String(aNum || "").trim();
    const bs = String(bNum || "").trim();
    if (as && bs && as !== bs) return as.localeCompare(bs);
  }

  const aLevel = Number(a?.level ?? a?.top_level ?? 0) || 0;
  const bLevel = Number(b?.level ?? b?.top_level ?? 0) || 0;
  if (aLevel !== bLevel) return aLevel - bLevel;

  const at = String(a?.title || "").trim();
  const bt = String(b?.title || "").trim();
  if (at && bt && at !== bt) return at.localeCompare(bt);

  const aid = String(a?.id ?? "").trim();
  const bid = String(b?.id ?? "").trim();
  if (aid && bid && aid !== bid) return aid.localeCompare(bid);
  return 0;
}

function _sortTopsByNumber(tops) {
  if (!Array.isArray(tops)) return;
  tops.sort(_compareTopNumbers);
}

function _resolveTodoResponsibleNames(db, rows) {
  const list = Array.isArray(rows) ? rows : [];
  const byKey = new Map();
  const projectFirmIds = new Set();
  const globalFirmIds = new Set();

  for (const t of list) {
    const kind = String(t?.responsible_kind || "").trim().toLowerCase();
    const id = String(t?.responsible_id ?? "").trim();
    if (!id) continue;
    if (kind === "project_firm" || kind === "company") projectFirmIds.add(id);
    else if (kind === "global_firm" || kind === "firm") globalFirmIds.add(id);
  }

  const loadNameMap = (table, ids) => {
    const arr = Array.from(ids);
    if (!arr.length) return new Map();
    const placeholders = arr.map(() => "?").join(",");
    const sql = `SELECT id, COALESCE(name, '') AS name FROM ${table} WHERE id IN (${placeholders})`;
    const rowsDb = db.prepare(sql).all(...arr);
    const m = new Map();
    for (const r of rowsDb || []) {
      const id = String(r?.id ?? "").trim();
      const name = String(r?.name || "").trim();
      if (id && name) m.set(id, name);
    }
    return m;
  };

  const projectNames = loadNameMap("project_firms", projectFirmIds);
  const globalNames = loadNameMap("firms", globalFirmIds);

  for (const t of list) {
    const kind = String(t?.responsible_kind || "").trim().toLowerCase();
    const id = String(t?.responsible_id ?? "").trim();
    if (!id) continue;
    if (kind === "project_firm" || kind === "company") {
      const name = projectNames.get(id) || "";
      if (name) {
        byKey.set(`project_firm::${id}`, name);
        byKey.set(`company::${id}`, name);
      }
      continue;
    }
    if (kind === "global_firm" || kind === "firm") {
      const name = globalNames.get(id) || "";
      if (name) {
        byKey.set(`global_firm::${id}`, name);
        byKey.set(`firm::${id}`, name);
      }
    }
  }

  return byKey;
}

function _buildTodoRows(db, rows) {
  const list = Array.isArray(rows) ? rows : [];
  const responsibleNames = _resolveTodoResponsibleNames(db, list);
  return list
    .filter((t) => !_isDoneStatus(t?.status))
    .filter((t) => {
      const lvl = Number(t?.level ?? t?.top_level ?? 0) || 0;
      return lvl >= 2 && lvl <= 4;
    })
    .map((t) => {
      const kind = String(t?.responsible_kind || "").trim().toLowerCase();
      const id = String(t?.responsible_id ?? "").trim();
      const resolved = id ? String(responsibleNames.get(`${kind}::${id}`) || "").trim() : "";
      const fallback = String(t?.responsible_label || t?.responsibleLabel || "").trim();
      let responsible = resolved || fallback;
      if (responsible.localeCompare("alle", "de-DE", { sensitivity: "base" }) === 0) {
        responsible = "";
      }
      return {
        id: String(t?.id ?? "").trim(),
        level: Number(t?.level ?? t?.top_level ?? 0) || 0,
        position: _normalizeTopNumber(t),
        title: String(t?.title || "").trim(),
        responsible,
        responsible_group: responsible || "Ohne Verantwortlich",
        due_date: String(t?.due_date || t?.dueDate || "").slice(0, 10),
        status: String(t?.status || "").trim(),
        _rawTop: t,
      };
    })
    .sort((a, b) => {
      const aHas = !!a.responsible;
      const bHas = !!b.responsible;
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (aHas && bHas) {
        const byResp = a.responsible.localeCompare(b.responsible, "de-DE", { sensitivity: "base" });
        if (byResp !== 0) return byResp;
      }
      return _compareTopNumbers(a._rawTop, b._rawTop);
    })
    .map(({ _rawTop, ...row }) => row);
}

function _defaultFirmRoleOrder() {
  return [10, 20, 30, 40, 50, 60];
}

function _defaultFirmRoleLabels() {
  return {
    10: "Bauherr",
    20: "Planer",
    30: "Sachverstaendige",
    40: "Ing.-Bueros",
    50: "Gewerke",
    60: "Sonstige",
  };
}

function _normalizeFirmRoleOrder(raw) {
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

  for (const n of _defaultFirmRoleOrder()) {
    if (seen.has(n)) continue;
    out.push(n);
    seen.add(n);
  }

  return out;
}

function _sortFirmsByRoleOrderAndName(firms, roleOrderRaw) {
  if (!Array.isArray(firms)) return [];
  const order = _normalizeFirmRoleOrder(roleOrderRaw);
  const pos = new Map(order.map((code, idx) => [Number(code), idx]));

  const list = [...firms];
  list.sort((a, b) => {
    const ra = Number(a?.role_code);
    const rb = Number(b?.role_code);
    const ai = pos.has(ra) ? pos.get(ra) : order.length;
    const bi = pos.has(rb) ? pos.get(rb) : order.length;
    if (ai !== bi) return ai - bi;

    const as = String(a?.label || a?.short || a?.name || "").trim().toLowerCase();
    const bs = String(b?.label || b?.short || b?.name || "").trim().toLowerCase();
    if (as < bs) return -1;
    if (as > bs) return 1;
    return 0;
  });
  return list;
}

function _normalizeFirmRoleLabels(raw) {
  const out = { ..._defaultFirmRoleLabels() };
  let parsed = null;
  try {
    const obj = JSON.parse(raw || "{}");
    if (obj && typeof obj === "object" && !Array.isArray(obj)) parsed = obj;
  } catch {
    parsed = null;
  }
  if (parsed) {
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(k);
      if (!Number.isFinite(n) || n <= 0) continue;
      const label = String(v || "").trim();
      if (!label) continue;
      out[n] = label;
    }
  }
  return out;
}

function _listFirmPersons(db, firm) {
  if (!db || !firm?.id) return [];
  const kind = String(firm.kind || "").trim();
  const id = firm.id;
  if (kind === "project_firm") {
    return db
      .prepare(
        `
        SELECT
          first_name,
          last_name,
          rolle,
          funktion,
          email,
          phone
        FROM project_persons
        WHERE project_firm_id = ?
          AND removed_at IS NULL
        ORDER BY COALESCE(LOWER(last_name), ''), COALESCE(LOWER(first_name), '')
      `
      )
      .all(id);
  }
  if (kind === "global_firm") {
    return db
      .prepare(
        `
        SELECT
          first_name,
          last_name,
          rolle,
          funktion,
          email,
          phone
        FROM persons
        WHERE firm_id = ?
          AND removed_at IS NULL
        ORDER BY COALESCE(LOWER(last_name), ''), COALESCE(LOWER(first_name), '')
      `
      )
      .all(id);
  }
  return [];
}

function _enrichFirmsForCards({ db, firms, settings }) {
  const labels = _normalizeFirmRoleLabels(settings?.["firm_role_labels"]);
  return (Array.isArray(firms) ? firms : []).map((f) => {
    const roleCode = Number(f?.role_code || 60) || 60;
    const persons = _listFirmPersons(db, f).map((p) => ({
      first_name: String(p?.first_name || "").trim(),
      last_name: String(p?.last_name || "").trim(),
      role_text: String(p?.rolle || p?.funktion || "").trim(),
      email: String(p?.email || "").trim(),
      phone: String(p?.phone || "").trim(),
    }));
    return {
      ...f,
      categoryLabel: String(labels[roleCode] || labels[60] || "Sonstige"),
      role_code: roleCode,
      street: String(f?.street || "").trim(),
      zip: String(f?.zip || "").trim(),
      city: String(f?.city || "").trim(),
      phone: String(f?.phone || "").trim(),
      email: String(f?.email || "").trim(),
      persons,
    };
  });
}

function _applyHierDisplayNumbers(tops, isOpen) {
  const list = Array.isArray(tops) ? tops : [];
  const baseById = new Map();
  const cache = new Map();
  for (const t of list) {
    if (t?.id != null) baseById.set(t.id, t);
  }

  const isGoodHierForNode = (node, v) => {
    if (!node) return false;
    if (!_isHierString(v)) return false;
    const s = String(v).trim();
    const hasParent = !!node.parent_top_id;
    const lvl = Number(node.level) || 1;
    if (hasParent || lvl > 1) return s.includes(".");
    return true;
  };

  const buildDisplay = (top) => {
    if (!top) return "";
    if (!isOpen && top.frozen_display_number && isGoodHierForNode(top, top.frozen_display_number)) {
      return String(top.frozen_display_number).trim();
    }
    if (cache.has(top.id)) return cache.get(top.id);
    const own = String(top.number ?? "").trim();
    if (!top.parent_top_id) {
      cache.set(top.id, own);
      return own;
    }
    const parent = baseById.get(top.parent_top_id);
    const val = parent ? (buildDisplay(parent) + "." + own) : own;
    cache.set(top.id, val);
    return val;
  };

  for (const t of list) {
    const val = buildDisplay(t);
    if (val) {
      t.display_number = val;
      t.topNumberText = val;
    }
  }
}

function _mapTopRow(row) {
  const frozenDisplay =
    row?.frozen_display_number ?? row?.frozenDisplayNumber ?? null;
  const displayRaw = row?.display_number ?? row?.displayNumber ?? null;
  const displayNumber = displayRaw != null ? String(displayRaw).trim() : _normalizeTopNumber(row);
  const topNumberText =
    row?.top_nr ??
    row?.topNr ??
    row?.topNo ??
    frozenDisplay ??
    displayNumber ??
    row?.number ??
    row?.nr ??
    "";
  return {
    ...row,
    frozen_display_number:
      frozenDisplay != null ? String(frozenDisplay).trim() : null,
    display_number: displayNumber,
    topNumberText: String(topNumberText ?? "").trim(),
  };
}

function _isDoneStatus(status) {
  return String(status || "").trim().toLowerCase() === "erledigt";
}

function _listMeetingParticipants(db, meetingId) {
  if (!meetingId) return [];
  return db
    .prepare(
      `
      SELECT
        mp.kind AS kind,
        mp.person_id AS personId,
        mp.is_present AS isPresent,
        mp.is_in_distribution AS isInDistribution,

        CASE
          WHEN mp.kind = 'project_person' THEN COALESCE(pp.name, '')
          ELSE COALESCE(p.name, '')
        END AS name,

        CASE
          WHEN mp.kind = 'project_person' THEN COALESCE(pp.rolle, pp.funktion, '')
          ELSE COALESCE(p.rolle, p.funktion, '')
        END AS rolle,

        CASE
          WHEN mp.kind = 'project_person' THEN COALESCE(pp.phone, '')
          ELSE COALESCE(p.phone, '')
        END AS telefon,

        CASE
          WHEN mp.kind = 'project_person' THEN COALESCE(pp.email, '')
          ELSE COALESCE(p.email, '')
        END AS email,

        CASE
          WHEN mp.kind = 'project_person' THEN COALESCE(pf.short, pf.name, '')
          ELSE COALESCE(f.short, f.name, '')
        END AS firm

      FROM meeting_participants mp
      LEFT JOIN project_persons pp
        ON mp.kind = 'project_person' AND pp.id = mp.person_id
      LEFT JOIN project_firms pf
        ON pp.project_firm_id = pf.id
      LEFT JOIN persons p
        ON mp.kind = 'global_person' AND p.id = mp.person_id
      LEFT JOIN firms f
        ON p.firm_id = f.id

      WHERE mp.meeting_id = ?

      ORDER BY firm COLLATE NOCASE, name COLLATE NOCASE
    `
    )
    .all(meetingId);
}


const PROJECT_PRINT_SETTINGS_KEYS = [
  "pdf.protocolTitle",
  "pdf.footerPlace",
  "pdf.footerDate",
  "pdf.footerName1",
  "pdf.footerName2",
  "pdf.footerRecorder",
  "pdf.footerStreet",
  "pdf.footerZip",
  "pdf.footerCity",
  "pdf.footerUseUserData",
];

const PRINT_SETTINGS_KEYS = [
    "print.interludeText",
    "print.logo1.enabled",
    "print.logo2.enabled",
    "print.logo3.enabled",
    "print.logo1.align",
    "print.logo1.vAlign",
    "print.logo2.align",
    "print.logo2.vAlign",
    "print.logo3.align",
    "print.logo3.vAlign",
    "print.logo1.pngDataUrl",
    "print.logo2.pngDataUrl",
    "print.logo3.pngDataUrl",
    "print.logo1.size",
    "print.logo2.size",
    "print.logo3.size",
    "print.logoSizePreset",
    "print.v2.globalHeaderAdaptive",
    "print.v2.pagePadLeftMm",
    "print.v2.pagePadRightMm",
    "print.v2.pagePadTopMm",
    "print.v2.pagePadBottomMm",
    "print.v2.footerReserveMm",
    "print.nextMeeting.enabled",
    "print.nextMeeting.date",
    "print.nextMeeting.time",
    "print.nextMeeting.place",
    "print.nextMeeting.extra",
    "print.preRemarks.enabled",
    "pdf.protocolTitle",
    "pdf.protocolsDir",
    "pdf.preRemarks",
    "pdf.footerPlace",
    "pdf.footerDate",
    "pdf.footerName1",
    "pdf.footerName2",
    "pdf.footerRecorder",
    "pdf.footerStreet",
    "pdf.footerZip",
    "pdf.footerCity",
    "pdf.footerUseUserData",
    "tops.ampelEnabled",
    "pdf.trafficLightAllEnabled",
    "firm_role_order",
    "firm_role_labels",
];

function _hasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function _hasMeaningfulValue(value) {
  if (value == null) return false;
  return String(value).trim() !== "";
}

function _isTouchedValue(rawTouched, userValue) {
  const touched = String(rawTouched ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "ja", "on"].includes(touched)) return true;
  if (["0", "false", "no", "nein", "off"].includes(touched)) return false;
  // Kompatibilitaet fuer bestehende Installationen ohne touched-Flags.
  return _hasMeaningfulValue(userValue);
}

function _resolveEffectiveSettings(rawSettings, keys) {
  const out = {};
  for (const key of keys || []) {
    const defaultKey = `defaults.${key}`;
    const touchedKey = `meta.touched.${key}`;
    const userValue = rawSettings?.[key];
    const touched = _isTouchedValue(rawSettings?.[touchedKey], userValue);
    if (!touched && _hasOwn(rawSettings, defaultKey)) {
      out[key] = rawSettings?.[defaultKey];
      continue;
    }
    out[key] = userValue;
  }
  return out;
}

function _loadSettings(db) {
  const metaKeys = [];
  for (const key of PRINT_SETTINGS_KEYS) {
    metaKeys.push(`defaults.${key}`);
    metaKeys.push(`meta.touched.${key}`);
  }
  const raw = appSettingsGetManyWithDb(db, [...PRINT_SETTINGS_KEYS, ...metaKeys]);
  return _resolveEffectiveSettings(raw || {}, PRINT_SETTINGS_KEYS);
}

function _buildV2Layout(settings, logos) {
  const adaptive = _parseBool(settings?.["print.v2.globalHeaderAdaptive"]);
  return {
    globalHeaderAdaptive: adaptive,
    globalLogoBoxHeightMm: 45,
    globalHeaderHeightMm: 50,
    pagePadLeftMm: _clampNumber(settings?.["print.v2.pagePadLeftMm"], 0, 30, 12),
    pagePadRightMm: _clampNumber(settings?.["print.v2.pagePadRightMm"], 0, 30, 12),
    pagePadTopMm: _clampNumber(settings?.["print.v2.pagePadTopMm"], 0, 40, 2),
    // Keep bottom page padding at 0mm; only footer reserve should limit the printable area.
    pagePadBottomMm: 0,
    footerReserveMm: _clampNumber(settings?.["print.v2.footerReserveMm"], 0, 30, 12),
  };
}

function _buildLogos(settings) {
  const legacyPreset = _normalizeLogoSize(settings?.["print.logoSizePreset"]);
  return [
    {
      key: "logo1",
      enabled: _parseBool(settings?.["print.logo1.enabled"]),
      dataUrl: String(settings?.["print.logo1.pngDataUrl"] || "").trim(),
      size: _normalizeLogoSize(settings?.["print.logo1.size"] || legacyPreset),
      align: _normalizeLogoAlign(settings?.["print.logo1.align"]),
      vAlign: _normalizeLogoVAlign(settings?.["print.logo1.vAlign"]),
    },
    {
      key: "logo2",
      enabled: _parseBool(settings?.["print.logo2.enabled"]),
      dataUrl: String(settings?.["print.logo2.pngDataUrl"] || "").trim(),
      size: _normalizeLogoSize(settings?.["print.logo2.size"] || legacyPreset),
      align: _normalizeLogoAlign(settings?.["print.logo2.align"]),
      vAlign: _normalizeLogoVAlign(settings?.["print.logo2.vAlign"]),
    },
    {
      key: "logo3",
      enabled: _parseBool(settings?.["print.logo3.enabled"]),
      dataUrl: String(settings?.["print.logo3.pngDataUrl"] || "").trim(),
      size: _normalizeLogoSize(settings?.["print.logo3.size"] || legacyPreset),
      align: _normalizeLogoAlign(settings?.["print.logo3.align"]),
      vAlign: _normalizeLogoVAlign(settings?.["print.logo3.vAlign"]),
    },
  ];
}

function _buildUserData(settings) {
  const name1 = String(settings?.["pdf.footerName1"] || "").trim();
  const name2 = String(settings?.["pdf.footerName2"] || "").trim();
  const street = String(settings?.["pdf.footerStreet"] || "").trim();
  const zip = String(settings?.["pdf.footerZip"] || "").trim();
  const city = String(settings?.["pdf.footerCity"] || "").trim();
  const hasAnyField = !!(name1 || name2 || street || zip || city);
  return {
    enabled: _parseBool(settings?.["pdf.footerUseUserData"]) || hasAnyField,
    name1,
    name2,
    street,
    zip,
    city,
  };
}

async function getPrintData({ mode, projectId, meetingId, settingsOverride } = {}) {
  const db = initDatabase();
  const project = projectId ? projectsRepo.getById(projectId) : null;
  const meeting = meetingId ? meetingsRepo.getMeetingById(meetingId) : null;
  const settingsBase = _loadSettings(db);
  const projectSettings = projectId
    ? projectSettingsRepo.getMany(projectId, PROJECT_PRINT_SETTINGS_KEYS)
    : {};
  const settings = { ...(settingsBase || {}), ...(projectSettings || {}), ...(settingsOverride || {}) };
  const protocolTitle = String(settings?.["pdf.protocolTitle"] || "").trim();
  const printProfile = _resolvePrintProfile(mode);
  const userData = _buildUserData(settings);
  const logos = _buildLogos(settings);
  const v2Layout = _buildV2Layout(settings, logos);

  const interludeText = String(settings?.["print.interludeText"] || "").trim();
  const meetingNextMeeting = {
    enabled: _parseBool(meeting?.next_meeting_enabled),
    date: String(meeting?.next_meeting_date || "").trim(),
    time: String(meeting?.next_meeting_time || "").trim(),
    place: String(meeting?.next_meeting_place || "").trim(),
    extra: String(meeting?.next_meeting_extra || "").trim(),
  };
  const hasMeetingNextMeeting =
    meetingNextMeeting.enabled ||
    !!(
      meetingNextMeeting.date ||
      meetingNextMeeting.time ||
      meetingNextMeeting.place ||
      meetingNextMeeting.extra
    );
  const settingsNextMeeting = {
    enabled: _parseBool(settings?.["print.nextMeeting.enabled"]),
    date: String(settings?.["print.nextMeeting.date"] || "").trim(),
    time: String(settings?.["print.nextMeeting.time"] || "").trim(),
    place: String(settings?.["print.nextMeeting.place"] || "").trim(),
    extra: String(settings?.["print.nextMeeting.extra"] || "").trim(),
  };
  const nextMeeting =
    String(mode || "").trim().toLowerCase() === "protocol"
      ? (hasMeetingNextMeeting ? meetingNextMeeting : { enabled: false, date: "", time: "", place: "", extra: "" })
      : (hasMeetingNextMeeting ? meetingNextMeeting : settingsNextMeeting);

  let participants = [];
  let tops = [];
  let firms = [];
  let todoRows = [];

  if (mode === "preview" || mode === "protocol" || mode === "headerTest") {
    participants = _listMeetingParticipants(db, meetingId);
    tops = meetingId ? meetingTopsRepo.listJoinedByMeeting(meetingId) : [];
    tops = (tops || []).map(_mapTopRow);
    _applyHierDisplayNumbers(tops, Number(meeting?.is_closed) !== 1);
    tops = _applyPrintFlagsAndFilter(tops);
    _sortTopsByNumber(tops);
  } else if (mode === "topsAll") {
    tops = projectId ? meetingTopsRepo.listLatestByProject(projectId) : [];
    tops = (tops || []).map(_mapTopRow);
    _applyHierDisplayNumbers(tops, false);
    tops = _applyPrintFlagsAndFilter(tops, { includeHidden: true });
    _sortTopsByNumber(tops);
  } else if (mode === "firms") {
    firms = projectId ? projectFirmsRepo.listFirmCandidatesByProject(projectId) : [];
    firms = _sortFirmsByRoleOrderAndName(firms, settings?.["firm_role_order"]);
    firms = _enrichFirmsForCards({ db, firms, settings });
  } else if (mode === "todo") {
    const rowsRaw = meetingId ? meetingTopsRepo.listJoinedByMeeting(meetingId) : [];
    const rows = (rowsRaw || []).map(_mapTopRow);
    _applyHierDisplayNumbers(rows, Number(meeting?.is_closed) !== 1);
    todoRows = _buildTodoRows(db, rows);
  }

  return {
    mode,
    project,
    meeting,
    settings,
    protocolTitle,
    printProfile,
    v2Layout,
    userData,
    logos,
    interludeText,
    nextMeeting,
    participants,
    tops,
    firms,
    todoRows,
  };
}

module.exports = { getPrintData };
