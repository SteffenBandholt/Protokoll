// src/main/db/projectsRepo.js
const { initDatabase } = require("./database");
const { randomUUID } = require("crypto");

let _ensuredProjectNumberColumn = false;
let _ensuredArchivedAtColumn = false;

function _normText(v) {
  const s = v !== undefined && v !== null ? String(v).trim() : "";
  return s ? s : null;
}

function _normName(v) {
  const s = v !== undefined && v !== null ? String(v).trim() : "";
  return s ? s : "";
}

function _tableExists(db, tableName) {
  try {
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(tableName);
    return !!row;
  } catch (_e) {
    return false;
  }
}

function _ensureProjectNumber(db) {
  if (_ensuredProjectNumberColumn) return;

  try {
    const cols = db.prepare("PRAGMA table_info(projects)").all();
    const has = (cols || []).some((c) => String(c.name || "") === "project_number");

    if (!has) {
      db.exec("ALTER TABLE projects ADD COLUMN project_number TEXT");
    }
  } catch (_e) {
    // If something goes wrong, do not crash the app here.
    // We keep the repo working without project_number.
  } finally {
    _ensuredProjectNumberColumn = true;
  }
}

function _ensureArchivedAt(db) {
  if (_ensuredArchivedAtColumn) return;

  try {
    const cols = db.prepare("PRAGMA table_info(projects)").all();
    const has = (cols || []).some((c) => String(c.name || "") === "archived_at");

    if (!has) {
      db.exec("ALTER TABLE projects ADD COLUMN archived_at TEXT");
    }
  } catch (_e) {
    // keep repo working; caller will fallback to queries without archived_at
  } finally {
    _ensuredArchivedAtColumn = true;
  }
}

function _addCamelAlias(p) {
  if (!p || typeof p !== "object") return p;

  // keep snake_case as source of truth; add camelCase alias for renderer convenience
  if (p.projectNumber === undefined) p.projectNumber = p.project_number ?? null;
  if (p.project_number === undefined) p.project_number = p.projectNumber ?? null;

  if (p.archivedAt === undefined) p.archivedAt = p.archived_at ?? null;
  if (p.archived_at === undefined) p.archived_at = p.archivedAt ?? null;

  return p;
}

function _safeGetById(db, projectId) {
  try {
    const p = db
      .prepare(
        `
        SELECT
          id,
          project_number,
          name,
          short,
          street,
          zip,
          city,
          project_lead,
          project_lead_phone,
          start_date,
          end_date,
          notes,
          archived_at
        FROM projects
        WHERE id = ?
      `
      )
      .get(projectId);

    return _addCamelAlias(p);
  } catch (_e) {
    // fallback without archived_at/project_number (very old dbs)
    try {
      const p = db
        .prepare(
          `
          SELECT
            id,
            project_number,
            name,
            short,
            street,
            zip,
            city,
            project_lead,
            project_lead_phone,
            start_date,
            end_date,
            notes
          FROM projects
          WHERE id = ?
        `
        )
        .get(projectId);

      if (p && typeof p === "object") p.archived_at = null;
      return _addCamelAlias(p);
    } catch (_e2) {
      const p = db
        .prepare(
          `
          SELECT
            id,
            name,
            short,
            street,
            zip,
            city,
            project_lead,
            project_lead_phone,
            start_date,
            end_date,
            notes
          FROM projects
          WHERE id = ?
        `
        )
        .get(projectId);

      if (p && typeof p === "object") {
        p.project_number = null;
        p.archived_at = null;
      }
      return _addCamelAlias(p);
    }
  }
}

function getById(projectId) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");

  _ensureProjectNumber(db);
  _ensureArchivedAt(db);
  return _safeGetById(db, projectId);
}

function _orderByProjectNumberAndNameSql() {
  return `
    ORDER BY
      CASE
        WHEN project_number IS NULL OR TRIM(project_number) = '' THEN 1
        ELSE 0
      END ASC,
      project_number COLLATE NOCASE ASC,
      name COLLATE NOCASE ASC
  `;
}

function listAll() {
  const db = initDatabase();

  _ensureProjectNumber(db);
  _ensureArchivedAt(db);

  // Active only: archived_at IS NULL
  try {
    const list = db
      .prepare(
        `
        SELECT
          id,
          project_number,
          name,
          short,
          street,
          zip,
          city,
          project_lead,
          project_lead_phone,
          start_date,
          end_date,
          notes,
          archived_at
        FROM projects
        WHERE archived_at IS NULL
        ${_orderByProjectNumberAndNameSql()}
      `
      )
      .all();

    return (list || []).map((x) => _addCamelAlias(x));
  } catch (_e) {
    // fallback: if archived_at not present, behave like old behavior (all projects are active)
    try {
      const list = db
        .prepare(
          `
          SELECT
            id,
            project_number,
            name,
            short,
            street,
            zip,
            city,
            project_lead,
            project_lead_phone,
            start_date,
            end_date,
            notes
          FROM projects
          ${_orderByProjectNumberAndNameSql()}
        `
        )
        .all();

      return (list || []).map((x) => _addCamelAlias({ ...x, archived_at: null }));
    } catch (_e2) {
      const list = db
        .prepare(
          `
          SELECT
            id,
            name,
            short,
            street,
            zip,
            city,
            project_lead,
            project_lead_phone,
            start_date,
            end_date,
            notes
          FROM projects
          ORDER BY name COLLATE NOCASE ASC
        `
        )
        .all();

      return (list || []).map((x) => _addCamelAlias({ ...x, project_number: null, archived_at: null }));
    }
  }
}

function listArchived() {
  const db = initDatabase();

  _ensureProjectNumber(db);
  _ensureArchivedAt(db);

  // Archived only: archived_at IS NOT NULL
  try {
    const list = db
      .prepare(
        `
        SELECT
          id,
          project_number,
          name,
          short,
          street,
          zip,
          city,
          project_lead,
          project_lead_phone,
          start_date,
          end_date,
          notes,
          archived_at
        FROM projects
        WHERE archived_at IS NOT NULL
        ORDER BY archived_at DESC, name COLLATE NOCASE ASC
      `
      )
      .all();

    return (list || []).map((x) => _addCamelAlias(x));
  } catch (_e) {
    // if archived_at missing, nothing is archived
    return [];
  }
}

/**
 * Backwards compatible:
 * - minimal: { name }
 * - extended fields optional (NULL if empty)
 * Accepts snake_case and camelCase for newer fields.
 */
function createProject(data) {
  const db = initDatabase();
  _ensureProjectNumber(db);
  _ensureArchivedAt(db);

  const d = data && typeof data === "object" ? data : {};

  const name = _normName(d.name ?? d.bezeichnung);
  if (!name) throw new Error("name required");

  const id = randomUUID();

  const project_number = _normText(d.project_number ?? d.projectNumber);

  const short = _normText(d.short);
  const street = _normText(d.street);
  const zip = _normText(d.zip);
  const city = _normText(d.city);

  const project_lead = _normText(d.project_lead ?? d.projectLead);
  const project_lead_phone = _normText(d.project_lead_phone ?? d.projectLeadPhone);

  const start_date = _normText(d.start_date ?? d.startDate);
  const end_date = _normText(d.end_date ?? d.endDate);

  const notes = _normText(d.notes);

  // archived_at always NULL on create
  const archived_at = null;

  // Try with archived_at + project_number; fallback if columns still not available.
  try {
    db.prepare(
      `
      INSERT INTO projects (
        id,
        project_number,
        name,
        short,
        street,
        zip,
        city,
        project_lead,
        project_lead_phone,
        start_date,
        end_date,
        notes,
        archived_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      id,
      project_number,
      name,
      short,
      street,
      zip,
      city,
      project_lead,
      project_lead_phone,
      start_date,
      end_date,
      notes,
      archived_at
    );
  } catch (_e) {
    try {
      db.prepare(
        `
        INSERT INTO projects (
          id,
          project_number,
          name,
          short,
          street,
          zip,
          city,
          project_lead,
          project_lead_phone,
          start_date,
          end_date,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        id,
        project_number,
        name,
        short,
        street,
        zip,
        city,
        project_lead,
        project_lead_phone,
        start_date,
        end_date,
        notes
      );
    } catch (_e2) {
      db.prepare(
        `
        INSERT INTO projects (
          id,
          name,
          short,
          street,
          zip,
          city,
          project_lead,
          project_lead_phone,
          start_date,
          end_date,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        id,
        name,
        short,
        street,
        zip,
        city,
        project_lead,
        project_lead_phone,
        start_date,
        end_date,
        notes
      );
    }
  }

  return _safeGetById(db, id);
}

/**
 * Update:
 * Expects { projectId|id, patch } or { projectId|id, ...patchFields }
 * Patch fields can be camelCase or snake_case.
 */
function updateProject(data) {
  const db = initDatabase();
  _ensureProjectNumber(db);
  _ensureArchivedAt(db);

  const d = data && typeof data === "object" ? data : {};

  const projectId = d.projectId ?? d.project_id ?? d.id ?? null;
  if (!projectId) throw new Error("projectId required");

  const rawPatch = d.patch && typeof d.patch === "object" ? d.patch : d;

  const patch = {
    project_number: rawPatch.project_number ?? rawPatch.projectNumber,

    name: rawPatch.name ?? rawPatch.bezeichnung,
    short: rawPatch.short,

    street: rawPatch.street,
    zip: rawPatch.zip,
    city: rawPatch.city,

    project_lead: rawPatch.project_lead ?? rawPatch.projectLead,
    project_lead_phone: rawPatch.project_lead_phone ?? rawPatch.projectLeadPhone,

    start_date: rawPatch.start_date ?? rawPatch.startDate,
    end_date: rawPatch.end_date ?? rawPatch.endDate,

    notes: rawPatch.notes,
  };

  const allowed = new Set([
    "project_number",
    "name",
    "short",
    "street",
    "zip",
    "city",
    "project_lead",
    "project_lead_phone",
    "start_date",
    "end_date",
    "notes",
  ]);

  const keys = Object.keys(patch).filter((k) => allowed.has(k) && patch[k] !== undefined);
  if (keys.length === 0) return _safeGetById(db, projectId);

  const sets = [];
  const vals = [];

  for (const k of keys) {
    if (k === "name") {
      const n = _normName(patch.name);
      if (!n) throw new Error("name required");
      sets.push("name = ?");
      vals.push(n);
      continue;
    }
    sets.push(`${k} = ?`);
    vals.push(_normText(patch[k]));
  }

  vals.push(projectId);

  db.prepare(
    `
    UPDATE projects
    SET ${sets.join(", ")}
    WHERE id = ?
  `
  ).run(...vals);

  return _safeGetById(db, projectId);
}

function archiveProject(projectId) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");

  _ensureArchivedAt(db);

  const now = new Date().toISOString();

  try {
    db.prepare(`UPDATE projects SET archived_at = ? WHERE id = ?`).run(now, projectId);
  } catch (_e) {
    // if archived_at is missing, ensure again and retry once
    _ensuredArchivedAtColumn = false;
    _ensureArchivedAt(db);
    db.prepare(`UPDATE projects SET archived_at = ? WHERE id = ?`).run(now, projectId);
  }

  return _safeGetById(db, projectId);
}

function unarchiveProject(projectId) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");

  _ensureArchivedAt(db);

  try {
    db.prepare(`UPDATE projects SET archived_at = NULL WHERE id = ?`).run(projectId);
  } catch (_e) {
    _ensuredArchivedAtColumn = false;
    _ensureArchivedAt(db);
    db.prepare(`UPDATE projects SET archived_at = NULL WHERE id = ?`).run(projectId);
  }

  return _safeGetById(db, projectId);
}

function deleteForever(projectId) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");

  // Hard delete: remove all project-related data
  // Strategy:
  // 1) delete project_persons (RESTRICT FK) for firms of this project
  // 2) delete project_firms
  // 3) delete meetings (cascades meeting_tops + meeting_participants)
  // 4) delete tops (cascades meeting_tops)
  // 5) delete other project-scoped tables
  // 6) delete projects row
  const tx = db.transaction(() => {
    // collect project_firm ids (for project_persons)
    let firmIds = [];
    if (_tableExists(db, "project_firms")) {
      firmIds = (db.prepare(`SELECT id FROM project_firms WHERE project_id = ?`).all(projectId) || [])
        .map((r) => r.id)
        .filter(Boolean);
    }

    if (firmIds.length && _tableExists(db, "project_persons")) {
      const delPP = db.prepare(`DELETE FROM project_persons WHERE project_firm_id = ?`);
      for (const fid of firmIds) delPP.run(fid);
    }

    if (_tableExists(db, "project_firms")) {
      db.prepare(`DELETE FROM project_firms WHERE project_id = ?`).run(projectId);
    }

    // meetings (and cascades)
    if (_tableExists(db, "meetings")) {
      // defensive cleanup before meetings delete (in case FK settings differ on old DBs)
      const mids = (db.prepare(`SELECT id FROM meetings WHERE project_id = ?`).all(projectId) || [])
        .map((r) => r.id)
        .filter(Boolean);

      if (mids.length && _tableExists(db, "meeting_participants")) {
        const delMP = db.prepare(`DELETE FROM meeting_participants WHERE meeting_id = ?`);
        for (const mid of mids) delMP.run(mid);
      }

      if (mids.length && _tableExists(db, "meeting_tops")) {
        const delMT = db.prepare(`DELETE FROM meeting_tops WHERE meeting_id = ?`);
        for (const mid of mids) delMT.run(mid);
      }

      db.prepare(`DELETE FROM meetings WHERE project_id = ?`).run(projectId);
    }

    // tops (and cascades)
    if (_tableExists(db, "tops")) {
      // defensive cleanup: meeting_tops may reference tops
      if (_tableExists(db, "meeting_tops")) {
        const topIds = (db.prepare(`SELECT id FROM tops WHERE project_id = ?`).all(projectId) || [])
          .map((r) => r.id)
          .filter(Boolean);

        if (topIds.length) {
          const delByTop = db.prepare(`DELETE FROM meeting_tops WHERE top_id = ?`);
          for (const tid of topIds) delByTop.run(tid);
        }
      }
      db.prepare(`DELETE FROM tops WHERE project_id = ?`).run(projectId);
    }

    // project-scoped link tables
    if (_tableExists(db, "project_candidates")) {
      db.prepare(`DELETE FROM project_candidates WHERE project_id = ?`).run(projectId);
    }
    if (_tableExists(db, "project_global_firms")) {
      db.prepare(`DELETE FROM project_global_firms WHERE project_id = ?`).run(projectId);
    }

    // finally project
    db.prepare(`DELETE FROM projects WHERE id = ?`).run(projectId);
  });

  tx();

  return { ok: true };
}

module.exports = {
  getById,
  listAll,
  listArchived,
  createProject,
  updateProject,
  archiveProject,
  unarchiveProject,
  deleteForever,
};
