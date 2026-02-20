// src/shared/ampel/pdfAmpelRule.js
// TECH-CONTRACT: PDF Ampel Regel (verbindlich) - Single Source of Truth

const DAY_MS = 24 * 60 * 60 * 1000;

function _toLocalDateOnly(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function _parseYmdToLocalDateOnly(ymd) {
  if (!ymd) return null;
  const s = String(ymd).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const dt = new Date(y, mo, da, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function _parseBool(v, fallback = false) {
  if (v == null || v === "") return fallback;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "ja", "on"].includes(s)) return true;
  if (["0", "false", "no", "nein", "off"].includes(s)) return false;
  return fallback;
}

function _getId(top) {
  return top?.id ?? top?.top_id ?? top?.topId ?? null;
}

function _getParentId(top) {
  return top?.parent_top_id ?? top?.parentTopId ?? null;
}

function _getLevel(top) {
  return Number(top?.level ?? top?.top_level ?? top?.topLevel ?? 0) || 0;
}

function _normalizeStatus(v) {
  return String(v || "").trim().toLowerCase();
}

export function shouldShowAmpelInPdf({ mode, meeting, settings } = {}) {
  const m = String(mode || "").trim().toLowerCase();
  const isVorabzug = m === "vorabzug" || m === "preview";
  const isClosed = Number(meeting?.is_closed ?? meeting?.isClosed ?? 0) === 1;

  const uiToggle = _parseBool(
    settings?.["tops.ampelEnabled"],
    _parseBool(settings?.["pdf.trafficLightAllEnabled"], true)
  );

  if (isVorabzug) return uiToggle;

  if (isClosed) {
    const frozenRaw = meeting?.pdf_show_ampel ?? meeting?.pdfShowAmpel ?? null;
    if (frozenRaw === 0 || frozenRaw === "0" || frozenRaw === false) return false;
    if (frozenRaw === 1 || frozenRaw === "1" || frozenRaw === true) return true;
  }

  return uiToggle;
}

export function computeAmpelColorForTop({ top, childrenColors, now } = {}) {
  const childList = Array.isArray(childrenColors) ? childrenColors : [];
  if (childList.length > 0) {
    const priority = ["blue", "red", "orange", "green"];
    for (const p of priority) {
      if (childList.some((c) => c === p)) return p;
    }
    return null;
  }

  const status = _normalizeStatus(top?.status);
  const dueDate = _parseYmdToLocalDateOnly(top?.due_date ?? top?.dueDate ?? null);
  const today = _toLocalDateOnly(now instanceof Date ? now : new Date()) || _toLocalDateOnly(new Date());

  if (status === "blockiert") return "blue";
  if (status === "verzug") return "red";
  if (status === "erledigt") return "green";

  const isDateRelevant = status === "offen" || status === "in arbeit";
  if (!isDateRelevant) return null;
  if (!dueDate || !today) return null;

  const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / DAY_MS);
  if (diffDays <= 0) return "red";
  if (diffDays <= 10) return "orange";
  return "green";
}

export function computeAmpelMapForTops({ tops, mode, meeting, settings, now } = {}) {
  const list = Array.isArray(tops) ? tops : [];
  const byId = new Map();
  const childrenByParent = new Map();

  for (const t of list) {
    const id = _getId(t);
    if (!id) continue;
    const key = String(id);
    byId.set(key, t);
    const pid = _getParentId(t);
    if (!pid) continue;
    const pkey = String(pid);
    if (!childrenByParent.has(pkey)) childrenByParent.set(pkey, []);
    childrenByParent.get(pkey).push(key);
  }

  const showAll = shouldShowAmpelInPdf({ mode, meeting, settings });
  const cache = new Map();

  const computeForId = (id) => {
    const key = String(id);
    if (cache.has(key)) return cache.get(key);
    const t = byId.get(key);
    if (!t) {
      cache.set(key, null);
      return null;
    }
    const childIds = childrenByParent.get(key) || [];
    if (childIds.length > 0) {
      const colors = childIds.map((cid) => computeForId(cid));
      const c = computeAmpelColorForTop({ top: t, childrenColors: colors, now });
      cache.set(key, c);
      return c;
    }
    const c = computeAmpelColorForTop({ top: t, childrenColors: [], now });
    cache.set(key, c);
    return c;
  };

  const out = new Map();
  for (const t of list) {
    const id = _getId(t);
    if (!id) continue;
    const level = _getLevel(t);
    const canShow = showAll && level >= 2 && level <= 4;
    const color = canShow ? computeForId(id) : null;
    out.set(String(id), { show: canShow, color });
  }

  return out;
}

export function ampelColorToHex(color) {
  const c = String(color || "").trim().toLowerCase();
  if (c === "blue") return "#1565c0";
  if (c === "red") return "#c62828";
  if (c === "orange") return "#ef6c00";
  if (c === "green") return "#2e7d32";
  return null;
}
