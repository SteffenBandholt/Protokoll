// src/main/db/projectPersonsRepo.js

const { initDatabase } = require("./database");
const { randomUUID } = require("crypto");

function _nowIso() {
  return new Date().toISOString();
}

function _norm(v) {
  const s = v !== undefined && v !== null ? String(v).trim() : "";
  return s ? s : null;
}

function _buildName(firstName, lastName) {
  const fn = (firstName || "").trim();
  const ln = (lastName || "").trim();
  const name = `${fn} ${ln}`.trim();
  return { fn, ln, name };
}

function getById(projectPersonId) {
  const db = initDatabase();
  if (!projectPersonId) throw new Error("projectPersonId required");

  return db.prepare(`
    SELECT *
    FROM project_persons
    WHERE id = ?
  `).get(projectPersonId);
}

function listActiveByProjectFirm(projectFirmId) {
  const db = initDatabase();
  if (!projectFirmId) throw new Error("projectFirmId required");

  return db.prepare(`
    SELECT *
    FROM project_persons
    WHERE project_firm_id = ?
      AND removed_at IS NULL
    ORDER BY
      COALESCE(LOWER(last_name), ''),
      COALESCE(LOWER(first_name), '')
  `).all(projectFirmId);
}

function listActiveByProject(projectId) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");

  return db.prepare(`
    SELECT
      pp.id,
      pp.project_firm_id,
      pp.first_name,
      pp.last_name,
      pp.email,
      pp.phone,
      pp.funktion,
      pp.rolle,
      pp.notes
    FROM project_persons pp
    JOIN project_firms pf ON pf.id = pp.project_firm_id
    WHERE pf.project_id = ?
      AND pp.removed_at IS NULL
      AND pf.removed_at IS NULL
    ORDER BY
      COALESCE(LOWER(pp.last_name), ''),
      COALESCE(LOWER(pp.first_name), '')
  `).all(projectId);
}

function createProjectPerson({
  projectFirmId,
  firstName,
  lastName,
  funktion,
  rolle,
  notes,
  email,
  phone,
}) {
  const db = initDatabase();
  if (!projectFirmId) throw new Error("projectFirmId required");

  const { fn, ln, name } = _buildName(firstName, lastName);
  if (!name) throw new Error("name required (firstName/lastName)");

  const id = randomUUID();
  const now = _nowIso();

  db.prepare(`
    INSERT INTO project_persons (
      id, project_firm_id,
      name,
      first_name, last_name,
      funktion, rolle, notes,
      email, phone,
      removed_at, created_at, updated_at
    )
    VALUES (
      ?, ?,
      ?,
      ?, ?,
      ?, ?, ?,
      ?, ?,
      NULL, ?, ?
    )
  `).run(
    id,
    projectFirmId,
    name,
    fn || null,
    ln || null,
    _norm(funktion),
    _norm(rolle),
    _norm(notes),
    _norm(email),
    _norm(phone),
    now,
    now
  );

  return getById(id);
}

function updateProjectPerson({ projectPersonId, patch }) {
  const db = initDatabase();
  if (!projectPersonId) throw new Error("projectPersonId required");
  if (!patch) throw new Error("patch required");

  const row = getById(projectPersonId);
  if (!row || row.removed_at) return row;

  const allowed = new Set([
    "first_name",
    "last_name",
    "email",
    "phone",
    "funktion",
    "rolle",
    "notes",
    "firstName",
    "lastName",
  ]);

  const keys = Object.keys(patch).filter((k) => allowed.has(k));
  if (keys.length === 0) return getById(projectPersonId);

  // erst neue first/last bestimmen -> name konsistent nachziehen
  let nextFirst = row.first_name || "";
  let nextLast = row.last_name || "";

  const readTrim = (v) => (v !== undefined && v !== null ? String(v).trim() : "");

  if (keys.includes("first_name")) nextFirst = readTrim(patch.first_name);
  if (keys.includes("firstName")) nextFirst = readTrim(patch.firstName);
  if (keys.includes("last_name")) nextLast = readTrim(patch.last_name);
  if (keys.includes("lastName")) nextLast = readTrim(patch.lastName);

  const { fn, ln, name } = _buildName(nextFirst, nextLast);
  if (!name) throw new Error("name required (first/last)");

  const sets = [];
  const vals = [];

  // first/last + name immer aktualisieren, wenn irgendwas davon im Patch war
  if (keys.includes("first_name") || keys.includes("firstName")) {
    sets.push("first_name = ?");
    vals.push(fn || null);
  }
  if (keys.includes("last_name") || keys.includes("lastName")) {
    sets.push("last_name = ?");
    vals.push(ln || null);
  }
  if (
    keys.includes("first_name") ||
    keys.includes("firstName") ||
    keys.includes("last_name") ||
    keys.includes("lastName")
  ) {
    sets.push("name = ?");
    vals.push(name);
  }

  if (keys.includes("email")) {
    sets.push("email = ?");
    vals.push(_norm(patch.email));
  }
  if (keys.includes("phone")) {
    sets.push("phone = ?");
    vals.push(_norm(patch.phone));
  }
  if (keys.includes("funktion")) {
    sets.push("funktion = ?");
    vals.push(_norm(patch.funktion));
  }
  if (keys.includes("rolle")) {
    sets.push("rolle = ?");
    vals.push(_norm(patch.rolle));
  }
  if (keys.includes("notes")) {
    sets.push("notes = ?");
    vals.push(_norm(patch.notes));
  }

  sets.push("updated_at = ?");
  vals.push(_nowIso());

  vals.push(projectPersonId);

  db.prepare(`
    UPDATE project_persons
    SET ${sets.join(", ")}
    WHERE id = ?
      AND removed_at IS NULL
  `).run(...vals);

  return getById(projectPersonId);
}

function softDeleteProjectPerson(projectPersonId) {
  const db = initDatabase();
  if (!projectPersonId) throw new Error("projectPersonId required");

  const inOpenMeeting = db
    .prepare(
      `
      SELECT m.meeting_index
      FROM project_persons pp
      INNER JOIN project_firms pf ON pf.id = pp.project_firm_id
      INNER JOIN meetings m ON m.project_id = pf.project_id
      INNER JOIN meeting_participants mp ON mp.meeting_id = m.id
      WHERE pp.id = ?
        AND pp.removed_at IS NULL
        AND pf.removed_at IS NULL
        AND m.is_closed = 0
        AND mp.kind = 'project_person'
        AND mp.person_id = pp.id
      LIMIT 1
    `
    )
    .get(projectPersonId);
  if (inOpenMeeting?.meeting_index != null) {
    throw new Error(
      `Entfernen blockiert: Person ist Teilnehmer in offener Besprechung #${inOpenMeeting.meeting_index}.`
    );
  }

  const inPool = db
    .prepare(
      `
      SELECT m.meeting_index
      FROM project_persons pp
      INNER JOIN project_firms pf ON pf.id = pp.project_firm_id
      INNER JOIN project_candidates pc ON pc.project_id = pf.project_id
      LEFT JOIN meetings m ON m.project_id = pf.project_id AND m.is_closed = 0
      WHERE pp.id = ?
        AND pp.removed_at IS NULL
        AND pf.removed_at IS NULL
        AND pc.kind = 'project_person'
        AND pc.person_id = pp.id
      LIMIT 1
    `
    )
    .get(projectPersonId);
  if (inPool) {
    throw new Error("Entfernen blockiert: Person ist noch im Personalpool. Bitte zuerst aus dem Pool entfernen.");
  }

  const now = _nowIso();

  const info = db.prepare(`
    UPDATE project_persons
    SET removed_at = ?, updated_at = ?
    WHERE id = ?
      AND removed_at IS NULL
  `).run(now, now, projectPersonId);

  return { changed: info.changes, row: getById(projectPersonId) };
}

function _normText(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function _normEmail(v) {
  return _normText(v).toLocaleLowerCase("de-DE");
}

function _buildImportKeys(row) {
  const firmId = _normText(row?.firm_id || row?.project_firm_id);
  if (!firmId) return { byEmail: "", byName: "" };

  const email = _normEmail(row?.email);
  const first = _normText(row?.first_name).toLocaleLowerCase("de-DE");
  const last = _normText(row?.last_name).toLocaleLowerCase("de-DE");

  const byEmail = email ? `${firmId}::email::${email}` : "";
  const byName = first || last ? `${firmId}::name::${first}::${last}` : "";
  return { byEmail, byName };
}

function _isFieldDirty(row, fieldName) {
  const map = row?.dirty_fields;
  if (!map || typeof map !== "object") return false;
  return Number(map[fieldName] || 0) === 1;
}

function importPersonsFromOutlookStaging({ projectId, stagingRows } = {}) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");
  const list = Array.isArray(stagingRows) ? stagingRows : [];

  const tx = db.transaction(() => {
    const now = _nowIso();

    const projectFirmRows = db.prepare(`
      SELECT id
      FROM project_firms
      WHERE project_id = ?
        AND removed_at IS NULL
    `).all(projectId);
    const firmIdSet = new Set(projectFirmRows.map((r) => String(r.id || "")));

    const existing = db.prepare(`
      SELECT
        pp.id,
        pp.project_firm_id AS firm_id,
        pp.first_name,
        pp.last_name,
        pp.email,
        pp.phone,
        pp.funktion,
        pp.rolle,
        pp.notes
      FROM project_persons pp
      JOIN project_firms pf ON pf.id = pp.project_firm_id
      WHERE pf.project_id = ?
        AND pp.removed_at IS NULL
        AND pf.removed_at IS NULL
    `).all(projectId);

    const byEmail = new Map();
    const byName = new Map();
    for (const row of existing) {
      const keys = _buildImportKeys(row);
      if (keys.byEmail && !byEmail.has(keys.byEmail)) byEmail.set(keys.byEmail, row);
      if (keys.byName && !byName.has(keys.byName)) byName.set(keys.byName, row);
    }

    let created = 0;
    let merged = 0;
    let skipped = 0;

    for (const row of list) {
      const take = Number(row?.take ?? 0) === 1;
      const firmId = _normText(row?.firm_id);
      const firstName = _normText(row?.first_name);
      const lastName = _normText(row?.last_name);

      if (!take || !firmId || !firmIdSet.has(firmId) || (!firstName && !lastName)) {
        skipped += 1;
        continue;
      }

      const email = _normEmail(row?.email);
      const phone = _norm(row?.phone);
      const funktion = _norm(row?.funktion);
      const rolle = _norm(row?.rolle);
      const notes = _norm(row?.notes);

      const candidate = {
        firm_id: firmId,
        first_name: firstName,
        last_name: lastName,
        email,
      };
      const keys = _buildImportKeys(candidate);

      let target = null;
      if (keys.byEmail) target = byEmail.get(keys.byEmail) || null;
      if (!target && keys.byName) target = byName.get(keys.byName) || null;

      if (!target) {
        const id = randomUUID();
        const fullName = `${firstName} ${lastName}`.trim();
        db.prepare(`
          INSERT INTO project_persons (
            id, project_firm_id,
            name,
            first_name, last_name,
            funktion, rolle, notes,
            email, phone,
            removed_at, created_at, updated_at
          )
          VALUES (
            ?, ?,
            ?,
            ?, ?,
            ?, ?, ?,
            ?, ?,
            NULL, ?, ?
          )
        `).run(
          id,
          firmId,
          fullName,
          firstName || null,
          lastName || null,
          funktion,
          rolle,
          notes,
          email || null,
          phone,
          now,
          now
        );

        const createdRow = {
          id,
          firm_id: firmId,
          first_name: firstName || null,
          last_name: lastName || null,
          email: email || null,
          phone,
          funktion,
          rolle,
          notes,
        };
        const createdKeys = _buildImportKeys(createdRow);
        if (createdKeys.byEmail) byEmail.set(createdKeys.byEmail, createdRow);
        if (createdKeys.byName) byName.set(createdKeys.byName, createdRow);
        created += 1;
        continue;
      }

      const patch = {};

      if (_isFieldDirty(row, "first_name")) {
        patch.first_name = firstName || null;
      } else if (!_normText(target.first_name) && firstName) {
        patch.first_name = firstName;
      }

      if (_isFieldDirty(row, "last_name")) {
        patch.last_name = lastName || null;
      } else if (!_normText(target.last_name) && lastName) {
        patch.last_name = lastName;
      }

      if (_isFieldDirty(row, "email")) {
        patch.email = email || null;
      } else if (!_normText(target.email) && email) {
        patch.email = email;
      }

      if (_isFieldDirty(row, "phone")) {
        patch.phone = phone;
      } else if (!_normText(target.phone) && phone) {
        patch.phone = phone;
      }

      if (_isFieldDirty(row, "funktion")) {
        patch.funktion = funktion;
      } else if (!_normText(target.funktion) && funktion) {
        patch.funktion = funktion;
      }

      if (_isFieldDirty(row, "rolle")) {
        patch.rolle = rolle;
      } else if (!_normText(target.rolle) && rolle) {
        patch.rolle = rolle;
      }

      if (_isFieldDirty(row, "notes")) {
        patch.notes = notes;
      } else if (!_normText(target.notes) && notes) {
        patch.notes = notes;
      }

      const nextFirst =
        patch.first_name !== undefined ? _normText(patch.first_name) : _normText(target.first_name);
      const nextLast =
        patch.last_name !== undefined ? _normText(patch.last_name) : _normText(target.last_name);
      const nextName = `${nextFirst} ${nextLast}`.trim();
      if (nextName) patch.name = nextName;

      const keysToUpdate = Object.keys(patch);
      if (keysToUpdate.length > 0) {
        const sets = keysToUpdate.map((k) => `${k} = ?`);
        const vals = keysToUpdate.map((k) => patch[k]);
        sets.push("updated_at = ?");
        vals.push(now);
        vals.push(target.id);

        db.prepare(`
          UPDATE project_persons
          SET ${sets.join(", ")}
          WHERE id = ?
            AND removed_at IS NULL
        `).run(...vals);

        Object.assign(target, patch);
        const nextKeys = _buildImportKeys(target);
        if (nextKeys.byEmail) byEmail.set(nextKeys.byEmail, target);
        if (nextKeys.byName) byName.set(nextKeys.byName, target);
      }

      merged += 1;
    }

    return { created, merged, skipped };
  });

  return tx();
}

module.exports = {
  getById,
  listActiveByProjectFirm,
  listActiveByProject,
  createProjectPerson,
  updateProjectPerson,
  softDeleteProjectPerson,
  importPersonsFromOutlookStaging,
};
