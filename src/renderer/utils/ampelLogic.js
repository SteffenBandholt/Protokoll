// src/renderer/utils/ampelLogic.js

const DAY_MS = 24 * 60 * 60 * 1000;

function toLocalDateOnly(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function parseYmdToLocalDateOnly(ymd) {
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

function computeSingleAmpel(top, today) {
  const status = String(top?.status || "").trim().toLowerCase();
  const dueDate = parseYmdToLocalDateOnly(top?.due_date ?? top?.dueDate ?? null);
  const base = today || toLocalDateOnly(new Date());

  if (status === "blockiert") return "blau";
  if (status === "verzug") return "rot";
  if (status === "erledigt") return "gruen";

  const isDateRelevant = status === "offen" || status === "in arbeit" || status === "todo";
  if (!isDateRelevant) return null;
  if (!dueDate) return null;
  if (!base) return null;

  const diffDays = Math.floor((dueDate.getTime() - base.getTime()) / DAY_MS);
  if (diffDays <= 0) return "rot";
  if (diffDays <= 10) return "orange";
  return "gruen";
}

function getId(top) {
  return top?.id ?? top?.top_id ?? null;
}

function getParentId(top) {
  return top?.parent_top_id ?? top?.parentTopId ?? null;
}

export function createAmpelComputer(allTops, now = new Date(), overridesById = null) {
  const list = Array.isArray(allTops) ? allTops : [];
  const byId = new Map();
  for (const t of list) {
    const id = getId(t);
    if (!id) continue;
    byId.set(String(id), t);
  }

  const today = toLocalDateOnly(now) || toLocalDateOnly(new Date());
  const cache = new Map();

  const resolveTop = (idOrTop) => {
    if (!idOrTop) return null;
    if (typeof idOrTop === "object") return idOrTop;
    return byId.get(String(idOrTop)) || null;
  };

  const resolveById = (id) => {
    if (!id) return null;
    if (overridesById && overridesById.has(String(id))) return overridesById.get(String(id));
    return byId.get(String(id)) || null;
  };

  const computeForId = (id) => {
    const key = String(id);
    if (cache.has(key)) return cache.get(key);

    const t = resolveById(key);
    if (!t) {
      cache.set(key, null);
      return null;
    }

    const color = computeSingleAmpel(t, today);
    cache.set(key, color);
    return color;
  };

  return (topOrId) => {
    const t = resolveTop(topOrId);
    const id = getId(t) || topOrId;
    if (!id) return null;
    return computeForId(id);
  };
}
