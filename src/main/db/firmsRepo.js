// src/main/db/firmsRepo.js

const { initDatabase } = require("./database");
const { randomUUID } = require("crypto");

function _nowIso() {
  return new Date().toISOString();
}

function _trimOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function _trimOrEmpty(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function _normRoleCode(v) {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return 60;
  const i = Math.trunc(n);
  if (!Number.isFinite(i) || i <= 0) return 60;
  return i;
}

function _isActiveFirmWhere() {
  return "removed_at IS NULL AND COALESCE(is_trashed, 0) = 0";
}

function getFirmById(firmId) {
  const db = initDatabase();
  if (!firmId) throw new Error("firmId required");

  return db
    .prepare(
      `
    SELECT *
    FROM firms
    WHERE id = ?
  `
    )
    .get(firmId);
}

function listActive() {
  const db = initDatabase();
  return db
    .prepare(
      `
    SELECT *
    FROM firms
    WHERE ${_isActiveFirmWhere()}
    ORDER BY
      COALESCE(role_code, 60) ASC,
      COALESCE(LOWER(name), ''),
      COALESCE(LOWER(short), '')
  `
    )
    .all();
}

function createFirm({
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

  const id = randomUUID();
  const now = _nowIso();

  const s = _trimOrNull(short);
  const n = _trimOrNull(name);
  if (!n) throw new Error("name required");

  db.prepare(
    `
    INSERT INTO firms (
      id,
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
      removed_at,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `
  ).run(
    id,
    s,
    n,
    _trimOrNull(name2),
    _trimOrNull(street),
    _trimOrNull(zip),
    _trimOrNull(city),
    _trimOrNull(phone),
    _trimOrNull(email),
    _trimOrNull(gewerk),
    notes !== undefined && notes !== null ? String(notes) : null,
    (_normRoleCode(role_code) !== undefined ? _normRoleCode(role_code) : 60),
    now,
    now
  );

  return getFirmById(id);
}

function updateFirm({ firmId, patch }) {
  const db = initDatabase();
  if (!firmId) throw new Error("firmId required");
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
  if (keys.length === 0) return getFirmById(firmId);

  const sets = [];
  const vals = [];

  for (const k of keys) {
    if (k === "name") {
      const n = _trimOrNull(patch.name);
      if (!n) throw new Error("name required");
      sets.push("name = ?");
      vals.push(n);
      continue;
    }

    if (k === "notes") {
      sets.push("notes = ?");
      vals.push(patch.notes !== undefined && patch.notes !== null ? String(patch.notes) : null);
      continue;
    }

    if (k === "role_code") {
      const rc = _normRoleCode(patch.role_code);
      sets.push("role_code = ?");
      vals.push(rc !== undefined ? rc : 60);
      continue;
    }

    // alle anderen Textfelder (trim -> null)
    sets.push(`${k} = ?`);
    vals.push(_trimOrNull(patch[k]));
  }

  sets.push("updated_at = ?");
  vals.push(_nowIso());

  vals.push(firmId);

  db.prepare(
    `
    UPDATE firms
    SET ${sets.join(", ")}
    WHERE id = ?
      AND ${_isActiveFirmWhere()}
  `
  ).run(...vals);

  return getFirmById(firmId);
}

function softDeleteFirm(firmId) {
  const db = initDatabase();
  if (!firmId) throw new Error("firmId required");

  const now = _nowIso();
  const nowTs = Date.now();

  const info = db
    .prepare(
      `
    UPDATE firms
    SET removed_at = ?, is_trashed = 1, trashed_at = COALESCE(trashed_at, ?), updated_at = ?
    WHERE id = ?
      AND ${_isActiveFirmWhere()}
  `
    )
    .run(now, nowTs, now, firmId);

  return { changed: info.changes, row: getFirmById(firmId) };
}

function markTrashed(firmId) {
  return softDeleteFirm(firmId);
}

function countActivePersonsByFirm(firmId) {
  const db = initDatabase();
  if (!firmId) throw new Error("firmId required");

  const row = db
    .prepare(
      `
    SELECT COUNT(*) AS n
    FROM persons
    WHERE firm_id = ?
      AND removed_at IS NULL
      AND COALESCE(is_trashed, 0) = 0
  `
    )
    .get(firmId);

  return Number(row?.n || 0);
}

function countByRoleCode(roleCode, dbConn) {
  const db = dbConn || initDatabase();
  const rc = Number(roleCode);
  if (!Number.isFinite(rc)) return 0;

  const row = db
    .prepare(
      `
    SELECT COUNT(*) AS n
    FROM firms
    WHERE ${_isActiveFirmWhere()}
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
    UPDATE firms
    SET role_code = ?, updated_at = ?
    WHERE ${_isActiveFirmWhere()}
      AND role_code = ?
  `
    )
    .run(to, _nowIso(), from);

  return Number(info?.changes || 0);
}

function _normText(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
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

function importFromOutlookStaging(stagingRows) {
  const db = initDatabase();
  const list = Array.isArray(stagingRows) ? stagingRows : [];

  const tx = db.transaction(() => {
    const now = _nowIso();
    const active = db
      .prepare(
        `
      SELECT id, short, name, name2, street, zip, city, phone, email, gewerk, notes
      FROM firms
      WHERE ${_isActiveFirmWhere()}
    `
      )
      .all();

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
        db.prepare(
          `
          INSERT INTO firms (
            id, short, name, name2, street, zip, city, phone, email, gewerk, notes, role_code, removed_at, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 60, NULL, ?, ?)
        `
        ).run(id, short, name1, name2, street, zip, city, phone, email, gewerk, notes, now, now);

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

      const nextNotes = _appendOutlookRawToNotes(patch.notes !== undefined ? patch.notes : existing.notes, addressRaw);
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
        db.prepare(
          `
          UPDATE firms
          SET ${sets.join(", ")}
          WHERE id = ?
            AND ${_isActiveFirmWhere()}
        `
        ).run(...vals);

        Object.assign(existing, patch);
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
      FROM firms
      WHERE COALESCE(is_trashed, 0) = 1
    `
    )
    .get();
  const trashedTotal = Number(row?.n || 0);

  const deletable = db
    .prepare(
      `
      SELECT f.id
      FROM firms f
      WHERE COALESCE(f.is_trashed, 0) = 1
        AND NOT EXISTS (SELECT 1 FROM persons p WHERE p.firm_id = f.id)
        AND NOT EXISTS (SELECT 1 FROM project_global_firms pgf WHERE pgf.firm_id = f.id)
    `
    )
    .all()
    .map((r) => String(r.id));

  if (!deletable.length) {
    return { deleted: 0, skippedReferenced: trashedTotal, trashedTotal };
  }

  const placeholders = deletable.map(() => "?").join(", ");
  const info = db.prepare(`DELETE FROM firms WHERE id IN (${placeholders})`).run(...deletable);
  const deleted = Number(info?.changes || 0);
  const skippedReferenced = Math.max(0, trashedTotal - deleted);
  return { deleted, skippedReferenced, trashedTotal };
}

module.exports = {
  getFirmById,
  listActive,
  createFirm,
  updateFirm,
  softDeleteFirm,
  markTrashed,
  purgeTrashedSafe,
  countActivePersonsByFirm,
  countByRoleCode,
  reassignRoleCode,
  importFromOutlookStaging,
};
