// src/main/db/personsRepo.js

const { initDatabase } = require("./database");
const { randomUUID } = require("crypto");

function _nowIso() {
  return new Date().toISOString();
}

function _trim(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function _trimOrNull(v) {
  const s = _trim(v);
  return s ? s : null;
}

function _buildName(firstName, lastName) {
  const fn = _trim(firstName);
  const ln = _trim(lastName);
  const name = `${fn} ${ln}`.trim();
  return { fn, ln, name };
}

function _isActivePersonWhere() {
  return "removed_at IS NULL AND COALESCE(is_trashed, 0) = 0";
}

function _isActivePersonWhereAlias(alias) {
  const a = String(alias || "").trim();
  if (!a) return _isActivePersonWhere();
  return `${a}.removed_at IS NULL AND COALESCE(${a}.is_trashed, 0) = 0`;
}

function getPersonById(personId) {
  const db = initDatabase();
  if (!personId) throw new Error("personId required");

  return db
    .prepare(
      `
    SELECT *
    FROM persons
    WHERE id = ?
  `
    )
    .get(personId);
}

function listActiveByFirm(firmId) {
  const db = initDatabase();
  if (!firmId) throw new Error("firmId required");

  return db
    .prepare(
      `
    SELECT *
    FROM persons
    WHERE firm_id = ?
      AND ${_isActivePersonWhere()}
    ORDER BY
      COALESCE(LOWER(last_name), ''),
      COALESCE(LOWER(first_name), '')
  `
    )
    .all(firmId);
}

function listActiveAll() {
  const db = initDatabase();
  return db
    .prepare(
      `
    SELECT *
    FROM persons
    WHERE ${_isActivePersonWhere()}
    ORDER BY
      COALESCE(LOWER(last_name), ''),
      COALESCE(LOWER(first_name), '')
  `
    )
    .all();
}

function createPerson({ firmId, firstName, lastName, email, phone, funktion, rolle, notes }) {
  const db = initDatabase();
  if (!firmId) throw new Error("firmId required");

  const id = randomUUID();
  const now = _nowIso();

  const { fn, ln, name } = _buildName(firstName, lastName);
  if (!name) throw new Error("Name ist Pflicht.");

  db.prepare(
    `
    INSERT INTO persons (
      id,
      firm_id,
      name,
      first_name,
      last_name,
      funktion,
      rolle,
      notes,
      email,
      phone,
      removed_at,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `
  ).run(
    id,
    firmId,
    name,
    fn || null,
    ln || null,
    _trimOrNull(funktion),
    _trimOrNull(rolle),
    notes !== undefined && notes !== null ? String(notes) : null,
    _trimOrNull(email),
    _trimOrNull(phone),
    now,
    now
  );

  return getPersonById(id);
}

function updatePerson({ personId, patch }) {
  const db = initDatabase();
  if (!personId) throw new Error("personId required");
  if (!patch) throw new Error("patch required");

  const allowed = new Set([
    "first_name",
    "last_name",
    "email",
    "phone",
    "firstName",
    "lastName",
    "funktion",
    "rolle",
    "notes",
  ]);

  const keys = Object.keys(patch).filter((k) => allowed.has(k));
  if (keys.length === 0) return getPersonById(personId);

  const current = getPersonById(personId);
  if (!current) throw new Error("Person nicht gefunden");

  const nextFirst =
    patch.first_name !== undefined
      ? _trim(patch.first_name)
      : patch.firstName !== undefined
      ? _trim(patch.firstName)
      : _trim(current.first_name || "");

  const nextLast =
    patch.last_name !== undefined
      ? _trim(patch.last_name)
      : patch.lastName !== undefined
      ? _trim(patch.lastName)
      : _trim(current.last_name || "");

  const { name: nextName } = _buildName(nextFirst, nextLast);
  if (!nextName) throw new Error("Name ist Pflicht.");

  const sets = [];
  const vals = [];

  for (const k of keys) {
    if (k === "first_name" || k === "firstName") {
      sets.push("first_name = ?");
      vals.push(_trimOrNull(patch[k]));
      continue;
    }
    if (k === "last_name" || k === "lastName") {
      sets.push("last_name = ?");
      vals.push(_trimOrNull(patch[k]));
      continue;
    }
    if (k === "email") {
      sets.push("email = ?");
      vals.push(_trimOrNull(patch.email));
      continue;
    }
    if (k === "phone") {
      sets.push("phone = ?");
      vals.push(_trimOrNull(patch.phone));
      continue;
    }
    if (k === "funktion") {
      sets.push("funktion = ?");
      vals.push(_trimOrNull(patch.funktion));
      continue;
    }
    if (k === "rolle") {
      sets.push("rolle = ?");
      vals.push(_trimOrNull(patch.rolle));
      continue;
    }
    if (k === "notes") {
      sets.push("notes = ?");
      vals.push(patch.notes !== undefined && patch.notes !== null ? String(patch.notes) : null);
      continue;
    }
  }

  // name immer konsistent halten
  sets.push("name = ?");
  vals.push(nextName);

  sets.push("updated_at = ?");
  vals.push(_nowIso());

  vals.push(personId);

  db.prepare(
    `
    UPDATE persons
    SET ${sets.join(", ")}
    WHERE id = ?
      AND ${_isActivePersonWhere()}
  `
  ).run(...vals);

  return getPersonById(personId);
}

function softDeletePerson(personId) {
  const db = initDatabase();
  if (!personId) throw new Error("personId required");

  const inOpenMeeting = db
    .prepare(
      `
      SELECT m.meeting_index
      FROM persons p
      INNER JOIN project_global_firms pgf ON pgf.firm_id = p.firm_id
      INNER JOIN meetings m ON m.project_id = pgf.project_id
      INNER JOIN meeting_participants mp ON mp.meeting_id = m.id
      WHERE p.id = ?
        AND ${_isActivePersonWhereAlias("p")}
        AND pgf.removed_at IS NULL
        AND m.is_closed = 0
        AND mp.kind = 'global_person'
        AND mp.person_id = p.id
      LIMIT 1
    `
    )
    .get(personId);
  if (inOpenMeeting?.meeting_index != null) {
    throw new Error(
      `Entfernen blockiert: Person ist Teilnehmer in einer offenen Besprechung (Index ${inOpenMeeting.meeting_index}).`
    );
  }

  const inPool = db
    .prepare(
      `
      SELECT pgf.project_id
      FROM persons p
      INNER JOIN project_global_firms pgf ON pgf.firm_id = p.firm_id
      INNER JOIN project_candidates pc ON pc.project_id = pgf.project_id
      WHERE p.id = ?
        AND ${_isActivePersonWhereAlias("p")}
        AND pgf.removed_at IS NULL
        AND pc.kind = 'global_person'
        AND pc.person_id = p.id
      LIMIT 1
    `
    )
    .get(personId);
  if (inPool?.project_id) {
    throw new Error("Entfernen blockiert: Person ist noch im Personalpool. Bitte zuerst aus dem Pool entfernen.");
  }

  const now = _nowIso();
  const nowTs = Date.now();

  const info = db
    .prepare(
      `
    UPDATE persons
    SET removed_at = ?, is_trashed = 1, trashed_at = COALESCE(trashed_at, ?), updated_at = ?
    WHERE id = ?
      AND ${_isActivePersonWhere()}
  `
    )
    .run(now, nowTs, now, personId);

  return { changed: info.changes, row: getPersonById(personId) };
}

function markTrashed(personId) {
  const db = initDatabase();
  if (!personId) throw new Error("personId required");

  const now = _nowIso();
  const nowTs = Date.now();

  const info = db
    .prepare(
      `
    UPDATE persons
    SET removed_at = COALESCE(removed_at, ?), is_trashed = 1, trashed_at = COALESCE(trashed_at, ?), updated_at = ?
    WHERE id = ?
      AND COALESCE(is_trashed, 0) = 0
  `
    )
    .run(now, nowTs, now, personId);

  return { changed: info.changes, row: getPersonById(personId) };
}

function _normText(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function _normEmail(v) {
  return _normText(v).toLocaleLowerCase("de-DE");
}

function _buildImportKeys(row) {
  const firmId = _normText(row?.firm_id);
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

function importPersonsFromOutlookStaging(stagingRows) {
  const db = initDatabase();
  const list = Array.isArray(stagingRows) ? stagingRows : [];

  const tx = db.transaction(() => {
    const now = _nowIso();
    const existing = db
      .prepare(
        `
      SELECT id, firm_id, first_name, last_name, email, phone, funktion, rolle, notes
      FROM persons
      WHERE ${_isActivePersonWhere()}
    `
      )
      .all();

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

      if (!take || !firmId || (!firstName && !lastName)) {
        skipped += 1;
        continue;
      }

      const email = _normEmail(row?.email);
      const phone = _trimOrNull(row?.phone);
      const funktion = _trimOrNull(row?.funktion);
      const rolle = _trimOrNull(row?.rolle);
      const notes = _trimOrNull(row?.notes);

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
        db.prepare(
          `
          INSERT INTO persons (
            id, firm_id, name, first_name, last_name, funktion, rolle, notes, email, phone, removed_at, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
        `
        ).run(
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

        db.prepare(
          `
          UPDATE persons
          SET ${sets.join(", ")}
          WHERE id = ?
            AND ${_isActivePersonWhere()}
        `
        ).run(...vals);

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

function purgeTrashedSafe() {
  const db = initDatabase();

  const row = db
    .prepare(
      `
      SELECT COUNT(*) AS n
      FROM persons
      WHERE COALESCE(is_trashed, 0) = 1
    `
    )
    .get();
  const trashedTotal = Number(row?.n || 0);

  const deletable = db
    .prepare(
      `
      SELECT p.id
      FROM persons p
      WHERE COALESCE(p.is_trashed, 0) = 1
        AND NOT EXISTS (
          SELECT 1
          FROM project_candidates pc
          WHERE pc.kind = 'global_person'
            AND pc.person_id = p.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM meeting_participants mp
          WHERE mp.kind = 'global_person'
            AND mp.person_id = p.id
        )
    `
    )
    .all()
    .map((r) => String(r.id));

  if (!deletable.length) {
    return { deleted: 0, skippedReferenced: trashedTotal, trashedTotal };
  }

  const placeholders = deletable.map(() => "?").join(", ");
  const info = db.prepare(`DELETE FROM persons WHERE id IN (${placeholders})`).run(...deletable);
  const deleted = Number(info?.changes || 0);
  const skippedReferenced = Math.max(0, trashedTotal - deleted);
  return { deleted, skippedReferenced, trashedTotal };
}

module.exports = {
  getPersonById,
  listActiveByFirm,
  listActiveAll,
  createPerson,
  updatePerson,
  softDeletePerson,
  markTrashed,
  purgeTrashedSafe,
  importPersonsFromOutlookStaging,
};
