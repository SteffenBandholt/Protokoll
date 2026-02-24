// src/main/print/printData.js
const { initDatabase } = require("../db/database");
const projectsRepo = require("../db/projectsRepo");
const meetingsRepo = require("../db/meetingsRepo");
const meetingTopsRepo = require("../db/meetingTopsRepo");
const projectFirmsRepo = require("../db/projectFirmsRepo");
const { appSettingsGetManyWithDb } = require("../db/appSettingsRepo");

function _parseBool(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  if (["1", "true", "yes", "ja", "on"].includes(s)) return true;
  return false;
}

function _docLabelForMode(mode) {
  const m = String(mode || "").trim();
  if (m === "preview" || m === "vorabzug") return "Vorabzug";
  if (m === "protocol") return "Protokoll";
  if (m === "topsAll") return "Top-Liste (alle)";
  if (m === "firms") return "Firmenliste";
  if (m === "todo") return "ToDo";
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
  const trashed = Number(t?.is_trashed ?? t?.isTrashed ?? 0) === 1;
  const removed = !!(t?.removed_at ?? t?.removedAt);
  return hidden || frozenHidden || trashed || removed;
}

function _applyPrintFlagsAndFilter(tops) {
  const list = Array.isArray(tops) ? tops : [];
  return list.filter((t) => {
    t.isNewTop = Number(t?.is_carried_over ?? t?.isCarriedOver ?? 0) !== 1;
    return !_isHiddenForPrint(t);
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

function _loadSettings(db) {
  const keys = [
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
    "print.nextMeeting.enabled",
    "print.nextMeeting.date",
    "print.nextMeeting.time",
    "print.nextMeeting.place",
    "print.nextMeeting.extra",
    "pdf.protocolTitle",
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
    "tops.ampelEnabled",
    "pdf.trafficLightAllEnabled",
  ];
  return appSettingsGetManyWithDb(db, keys);
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

async function getPrintData({ mode, projectId, meetingId } = {}) {
  const db = initDatabase();
  const project = projectId ? projectsRepo.getById(projectId) : null;
  const meeting = meetingId ? meetingsRepo.getMeetingById(meetingId) : null;
  const settings = _loadSettings(db);
  const protocolTitle = String(settings?.["pdf.protocolTitle"] || "").trim();
  const printProfile = _resolvePrintProfile(mode);
  const userData = _buildUserData(settings);
  const logos = _buildLogos(settings);

  const interludeText = String(settings?.["print.interludeText"] || "").trim();
  const nextMeeting = {
    enabled:
      _parseBool(settings?.["print.nextMeeting.enabled"]) ||
      !!(
        String(settings?.["print.nextMeeting.date"] || "").trim() ||
        String(settings?.["print.nextMeeting.time"] || "").trim() ||
        String(settings?.["print.nextMeeting.place"] || "").trim() ||
        String(settings?.["print.nextMeeting.extra"] || "").trim()
      ),
    date: String(settings?.["print.nextMeeting.date"] || "").trim(),
    time: String(settings?.["print.nextMeeting.time"] || "").trim(),
    place: String(settings?.["print.nextMeeting.place"] || "").trim(),
    extra: String(settings?.["print.nextMeeting.extra"] || "").trim(),
  };

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
    tops = _applyPrintFlagsAndFilter(tops);
    _sortTopsByNumber(tops);
  } else if (mode === "firms") {
    firms = projectId ? projectFirmsRepo.listFirmCandidatesByProject(projectId) : [];
  } else if (mode === "todo") {
    const rows = meetingId ? meetingTopsRepo.listJoinedByMeeting(meetingId) : [];
    todoRows = rows
      .filter((t) => !_isDoneStatus(t?.status))
      .map((t) => ({
        position: _normalizeTopNumber(t),
        title: String(t?.title || "").trim(),
        responsible: String(t?.responsible_label || t?.responsibleLabel || "").trim(),
        due_date: String(t?.due_date || t?.dueDate || "").slice(0, 10),
        status: String(t?.status || "").trim(),
      }));
  }

  return {
    mode,
    project,
    meeting,
    settings,
    protocolTitle,
    printProfile,
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
