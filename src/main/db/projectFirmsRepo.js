// src/main/db/projectFirmsRepo.js

const { initDatabase } = require("./database");
const { randomUUID } = require("crypto");

function _nowIso() {
  return new Date().toISOString();
}

function _label(short, name) {
  const s = (short || "").trim();
  if (s) return s;
  const n = (name || "").trim();
  if (n) return n;
  return "(ohne Name)";
}

function _normalizeActiveFlag(v) {
  if (v === undefined || v === null || v === "") return 1;
  const n = Number(v);
  if (Number.isFinite(n)) return n === 0 ? 0 : 1;
  const s = String(v).trim().toLowerCase();
  if (["0", "false", "off", "nein", "inactive"].includes(s)) return 0;
  return 1;
}

function getById(projectFirmId) {
  const db = initDatabase();
  if (!projectFirmId) throw new Error("projectFirmId required");

  return db.prepare(`
    SELECT *
    FROM project_firms
    WHERE id = ?
  `).get(projectFirmId);
}

function listActiveByProject(projectId) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");

  const rows = db.prepare(`
    SELECT *
    FROM project_firms
    WHERE project_id = ?
      AND removed_at IS NULL
    ORDER BY
      COALESCE(role_code, 60) ASC,
      COALESCE(LOWER(short), ''),
      COALESCE(LOWER(name), '')
  `).all(projectId);

  return rows.map((row) => ({
    ...row,
    is_active: _normalizeActiveFlag(row?.is_active),
  }));
}

/**
 * Kandidaten für TOP->Verantwortlich:
 * - lokale Projektfirmen (project_firms)
 * - global zugeordnete Firmen (project_global_firms + firms)
 *
 * Einheitliches Format:
 * { kind: 'project_firm'|'global_firm', id, short, name, label }
 */
function listFirmCandidatesByProject(projectId) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");

  const locals = db.prepare(`
    SELECT
      id,
      short,
      name,
      street,
      zip,
      city,
      phone,
      email,
      COALESCE(role_code, 60) AS role_code,
      COALESCE(is_active, 1) AS is_active
    FROM project_firms
    WHERE project_id = ?
      AND removed_at IS NULL
  `).all(projectId).map((r) => ({
    kind: "project_firm",
    id: r.id,
    short: r.short ?? null,
    name: r.name ?? null,
    street: r.street ?? null,
    zip: r.zip ?? null,
    city: r.city ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    role_code: Number(r.role_code || 60) || 60,
    is_active: _normalizeActiveFlag(r.is_active),
    label: _label(r.short, r.name),
  }));

  const globals = db.prepare(`
    SELECT
      f.id AS id,
      f.short AS short,
      f.name AS name,
      f.street AS street,
      f.zip AS zip,
      f.city AS city,
      f.phone AS phone,
      f.email AS email,
      COALESCE(f.role_code, 60) AS role_code,
      COALESCE(pgf.is_active, 1) AS is_active
    FROM project_global_firms pgf
    JOIN firms f ON f.id = pgf.firm_id
    WHERE pgf.project_id = ?
      AND pgf.removed_at IS NULL
      AND f.removed_at IS NULL
  `).all(projectId).map((r) => ({
    kind: "global_firm",
    id: r.id,
    short: r.short ?? null,
    name: r.name ?? null,
    street: r.street ?? null,
    zip: r.zip ?? null,
    city: r.city ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    role_code: Number(r.role_code || 60) || 60,
    is_active: _normalizeActiveFlag(r.is_active),
    label: _label(r.short, r.name),
  }));

  const all = [...locals, ...globals];

  // einheitlich sortieren (Kurzbez bevorzugt über label)
  all.sort((a, b) => {
    const as = String(a.label || "").toLowerCase();
    const bs = String(b.label || "").toLowerCase();
    if (as < bs) return -1;
    if (as > bs) return 1;
    return 0;
  });

  return all;
}

function assignGlobalFirmToProject({ projectId, firmId }) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");
  if (!firmId) throw new Error("firmId required");

  const now = _nowIso();

  // Insert falls neu, sonst "undelete"
  db.prepare(`
    INSERT OR IGNORE INTO project_global_firms (project_id, firm_id, removed_at)
    VALUES (?, ?, NULL)
  `).run(projectId, firmId);

  const info = db.prepare(`
    UPDATE project_global_firms
    SET removed_at = NULL, is_active = 1, updated_at = ?
    WHERE project_id = ?
      AND firm_id = ?
  `).run(now, projectId, firmId);

  return { changed: info.changes, project_id: projectId, firm_id: firmId };
}

function unassignGlobalFirmFromProject({ projectId, firmId }) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");
  if (!firmId) throw new Error("firmId required");

  const now = _nowIso();

  const info = db.prepare(`
    UPDATE project_global_firms
    SET removed_at = ?, updated_at = ?
    WHERE project_id = ?
      AND firm_id = ?
      AND removed_at IS NULL
  `).run(now, now, projectId, firmId);

  return { changed: info.changes, project_id: projectId, firm_id: firmId, removed_at: now };
}

function setProjectFirmActive({ projectId, firmId, isActive }) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");
  if (!firmId) throw new Error("firmId required");

  const active = _normalizeActiveFlag(isActive);
  const now = _nowIso();

  const tx = db.transaction(() => {
    const localInfo = db.prepare(`
      UPDATE project_firms
      SET is_active = ?, updated_at = ?
      WHERE project_id = ?
        AND id = ?
        AND removed_at IS NULL
    `).run(active, now, projectId, firmId);

    const globalInfo = db.prepare(`
      UPDATE project_global_firms
      SET is_active = ?, updated_at = ?
      WHERE project_id = ?
        AND firm_id = ?
        AND removed_at IS NULL
    `).run(active, now, projectId, firmId);

    return Number(localInfo?.changes || 0) + Number(globalInfo?.changes || 0);
  });

  const changed = tx();
  return {
    changed,
    project_id: projectId,
    firm_id: firmId,
    is_active: active,
  };
}

function canDeactivateProjectFirm({ projectId, firmId }) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");
  if (!firmId) throw new Error("firmId required");

  const local = db
    .prepare(
      `
      SELECT id
      FROM project_firms
      WHERE project_id = ?
        AND id = ?
        AND removed_at IS NULL
      LIMIT 1
    `
    )
    .get(projectId, firmId);

  const global = db
    .prepare(
      `
      SELECT firm_id
      FROM project_global_firms
      WHERE project_id = ?
        AND firm_id = ?
        AND removed_at IS NULL
      LIMIT 1
    `
    )
    .get(projectId, firmId);

  if (!local && !global) {
    return {
      canDeactivate: false,
      count: 0,
      reason: "Firma ist dem Projekt nicht zugeordnet.",
    };
  }

  let count = 0;

  if (local) {
    const c1 = db
      .prepare(
        `
        SELECT COUNT(*) AS cnt
        FROM meetings m
        INNER JOIN meeting_participants mp
          ON mp.meeting_id = m.id
         AND mp.kind = 'project_person'
        INNER JOIN project_persons pp
          ON pp.id = mp.person_id
        WHERE m.project_id = ?
          AND pp.project_firm_id = ?
      `
      )
      .get(projectId, firmId);
    count += Number(c1?.cnt || 0);
  }

  if (global) {
    const c2 = db
      .prepare(
        `
        SELECT COUNT(*) AS cnt
        FROM meetings m
        INNER JOIN meeting_participants mp
          ON mp.meeting_id = m.id
         AND mp.kind = 'global_person'
        INNER JOIN persons p
          ON p.id = mp.person_id
        WHERE m.project_id = ?
          AND p.firm_id = ?
      `
      )
      .get(projectId, firmId);
    count += Number(c2?.cnt || 0);
  }

  return {
    canDeactivate: count === 0,
    count,
  };
}

function createProjectFirm({
  projectId,
  short,
  name,
  name2,
  street,
  zip,
  city,
  phone,
  email,
  gewerk,
  notes,
  role_code,
}) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");

  const n1 = (name || "").trim();
  if (!n1) throw new Error("name is required");

  const id = randomUUID();
  const now = _nowIso();

  const norm = (v) => {
    const s = v !== undefined && v !== null ? String(v).trim() : "";
    return s ? s : null;
  };

  const normRoleCode = (v) => {
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n)) return 60;
    const i = Math.trunc(n);
    if (!Number.isFinite(i) || i <= 0) return 60;
    return i;
  };

  db.prepare(`
    INSERT INTO project_firms (
      id, project_id,
      short, name, name2, street, zip, city, phone, email, gewerk, notes,
      role_code,
      removed_at, created_at, updated_at
    )
    VALUES (
      ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?,
      NULL, ?, ?
    )
  `).run(
    id,
    projectId,
    norm(short),
    n1,
    norm(name2),
    norm(street),
    norm(zip),
    norm(city),
    norm(phone),
    norm(email),
    norm(gewerk),
    norm(notes),
    (normRoleCode(role_code) !== undefined ? normRoleCode(role_code) : 60),
    now,
    now
  );

  return getById(id);
}

function updateProjectFirm({ projectFirmId, patch }) {
  const db = initDatabase();
  if (!projectFirmId) throw new Error("projectFirmId required");
  if (!patch) throw new Error("patch required");

  const allowed = new Set([
    "short",
    "name",
    "name2",
    "street",
    "zip",
    "city",
    "phone",
    "email",
    "gewerk",
    "notes",
    "role_code",
  ]);

  const keys = Object.keys(patch).filter((k) => allowed.has(k));
  if (keys.length === 0) return getById(projectFirmId);

  const sets = [];
  const vals = [];

  const norm = (v) => {
    const s = v !== undefined && v !== null ? String(v).trim() : "";
    return s ? s : null;
  };

  const normRoleCode = (v) => {
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n)) return 60;
    const i = Math.trunc(n);
    if (!Number.isFinite(i) || i <= 0) return 60;
    return i;
  };

  for (const k of keys) {
    if (k === "name") {
      const n = (patch.name || "").trim();
      if (!n) throw new Error("name is required");
      sets.push("name = ?");
      vals.push(n);
      continue;
    }
    if (k === "role_code") {
      const rc = normRoleCode(patch[k]);
      sets.push("role_code = ?");
      vals.push(rc !== undefined ? rc : 60);
      continue;
    }
    sets.push(`${k} = ?`);
    vals.push(norm(patch[k]));
  }

  sets.push("updated_at = ?");
  vals.push(_nowIso());

  vals.push(projectFirmId);

  db.prepare(`
    UPDATE project_firms
    SET ${sets.join(", ")}
    WHERE id = ?
      AND removed_at IS NULL
  `).run(...vals);

  return getById(projectFirmId);
}

function _countActivePersons(projectFirmId) {
  const db = initDatabase();
  return db.prepare(`
    SELECT COUNT(*) AS c
    FROM project_persons
    WHERE project_firm_id = ?
      AND removed_at IS NULL
  `).get(projectFirmId)?.c || 0;
}

function countByRoleCode(roleCode, dbConn) {
  const db = dbConn || initDatabase();
  const rc = Number(roleCode);
  if (!Number.isFinite(rc)) return 0;

  const row = db
    .prepare(
      `
    SELECT COUNT(*) AS n
    FROM project_firms
    WHERE removed_at IS NULL
      AND role_code = ?
  `
    )
    .get(rc);

  return Number(row?.n || 0);
}

function reassignRoleCode({ fromCode, toCode, dbConn } = {}) {
  const db = dbConn || initDatabase();
  const from = Number(fromCode);
  const to = Number(toCode);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;

  const info = db
    .prepare(
      `
    UPDATE project_firms
    SET role_code = ?, updated_at = ?
    WHERE removed_at IS NULL
      AND role_code = ?
  `
    )
    .run(to, _nowIso(), from);

  return Number(info?.changes || 0);
}

function softDeleteProjectFirm(projectFirmId) {
  const db = initDatabase();
  if (!projectFirmId) throw new Error("projectFirmId required");

  const active = _countActivePersons(projectFirmId);
  if (active > 0) {
    throw new Error("Entfernen blockiert: zuerst zugeordnete Mitarbeiter entfernen.");
  }

  const now = _nowIso();

  const info = db.prepare(`
    UPDATE project_firms
    SET removed_at = ?, updated_at = ?
    WHERE id = ?
      AND removed_at IS NULL
  `).run(now, now, projectFirmId);

  return { changed: info.changes, row: getById(projectFirmId) };
}

function _normText(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function _trimOrNull(v) {
  const s = _normText(v);
  return s || null;
}

function _appendOutlookRawToNotes(oldNotes, addressRaw) {
  const raw = _normText(addressRaw);
  if (!raw) return oldNotes == null ? null : String(oldNotes);

  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
  const add = `Outlook Import (${ts}):\n${raw}`;
  const prev = _normText(oldNotes);
  if (!prev) return add;
  return `${prev}\n\n${add}`;
}

function importFromOutlookStaging({ projectId, stagingRows } = {}) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");
  const list = Array.isArray(stagingRows) ? stagingRows : [];

  const tx = db.transaction(() => {
    const now = _nowIso();
    const active = db.prepare(`
      SELECT id, short, name, name2, street, zip, city, phone, email, gewerk, notes
      FROM project_firms
      WHERE project_id = ?
        AND removed_at IS NULL
    `).all(projectId);

    const byName = new Map();
    for (const f of active) {
      const key = _normText(f?.name).toLocaleLowerCase("de-DE");
      if (!key || byName.has(key)) continue;
      byName.set(key, f);
    }

    let created = 0;
    let merged = 0;
    let skipped = 0;

    for (const row of list) {
      const take = Number(row?.take ?? 0) === 1;
      const name1 = _normText(row?.name1);
      if (!take || !name1) {
        skipped += 1;
        continue;
      }

      const key = name1.toLocaleLowerCase("de-DE");
      const existing = byName.get(key) || null;

      const short = _trimOrNull(row?.short);
      const name2 = _trimOrNull(row?.name2);
      const street = _trimOrNull(row?.street);
      const zip = _trimOrNull(row?.zip);
      const city = _trimOrNull(row?.city);
      const phone = _trimOrNull(row?.phone);
      const email = _trimOrNull(row?.email);
      const gewerk = _trimOrNull(row?.gewerk);
      const notesManual = _trimOrNull(row?.notes);
      const addressRaw = _normText(row?.address_raw);

      if (!existing) {
        const id = randomUUID();
        const notes = _appendOutlookRawToNotes(notesManual, addressRaw);
        db.prepare(`
          INSERT INTO project_firms (
            id, project_id,
            short, name, name2, street, zip, city, phone, email, gewerk, notes,
            role_code,
            removed_at, created_at, updated_at
          )
          VALUES (
            ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            60,
            NULL, ?, ?
          )
        `).run(
          id,
          projectId,
          short,
          name1,
          name2,
          street,
          zip,
          city,
          phone,
          email,
          gewerk,
          notes,
          now,
          now
        );

        const createdRow = {
          id,
          short,
          name: name1,
          name2,
          street,
          zip,
          city,
          phone,
          email,
          gewerk,
          notes,
        };
        byName.set(key, createdRow);
        created += 1;
        continue;
      }

      const patch = {};
      if (!_normText(existing.short) && short) patch.short = short;
      if (!_normText(existing.name2) && name2) patch.name2 = name2;
      if (!_normText(existing.street) && street) patch.street = street;
      if (!_normText(existing.zip) && zip) patch.zip = zip;
      if (!_normText(existing.city) && city) patch.city = city;
      if (!_normText(existing.phone) && phone) patch.phone = phone;
      if (!_normText(existing.email) && email) patch.email = email;
      if (!_normText(existing.gewerk) && gewerk) patch.gewerk = gewerk;
      if (!_normText(existing.notes) && notesManual) patch.notes = notesManual;

      const nextNotes = _appendOutlookRawToNotes(
        patch.notes !== undefined ? patch.notes : existing.notes,
        addressRaw
      );
      if (String(nextNotes || "") !== String(existing.notes || "")) {
        patch.notes = nextNotes;
      }

      const keys = Object.keys(patch);
      if (keys.length > 0) {
        const sets = keys.map((k) => `${k} = ?`);
        const vals = keys.map((k) => patch[k]);
        sets.push("updated_at = ?");
        vals.push(now);
        vals.push(existing.id);
        db.prepare(`
          UPDATE project_firms
          SET ${sets.join(", ")}
          WHERE id = ?
            AND removed_at IS NULL
        `).run(...vals);

        Object.assign(existing, patch);
      }

      merged += 1;
    }

    return { created, merged, skipped };
  });

  return tx();
}

module.exports = {
  getById,
  listActiveByProject,
  listFirmCandidatesByProject,
  assignGlobalFirmToProject,
  unassignGlobalFirmFromProject,
  setProjectFirmActive,
  canDeactivateProjectFirm,
  createProjectFirm,
  updateProjectFirm,
  softDeleteProjectFirm,
  countByRoleCode,
  reassignRoleCode,
  importFromOutlookStaging,
};
