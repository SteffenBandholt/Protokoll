// src/main/db/topsRepo.js

const { initDatabase } = require("./database");
const { randomUUID } = require("crypto");

function getTopById(topId) {
  const db = initDatabase();
  return db.prepare(`
    SELECT *
    FROM tops
    WHERE id = ?
  `).get(topId);
}

/**
 * Nächste Nummer innerhalb der Geschwistergruppe:
 * - pro project_id
 * - pro parent_top_id (NULL = Root)
 */
function getNextNumber(projectId, parentTopId) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");

  const row = db.prepare(`
    SELECT COALESCE(MAX(number), 0) + 1 AS next
    FROM tops
    WHERE project_id = ?
      AND parent_top_id IS ?
  `).get(projectId, parentTopId ?? null);

  return row.next;
}

function hasChildren(topId) {
  const db = initDatabase();
  if (!topId) throw new Error("topId required");

  const row = db.prepare(`
    SELECT 1 AS one
    FROM tops
    WHERE parent_top_id = ?
      AND removed_at IS NULL
    LIMIT 1
  `).get(topId);

  return !!row;
}

function createTop({ projectId, parentTopId, level, number, title }) {
  const db = initDatabase();

  if (!projectId) throw new Error("projectId required");
  if (!level) throw new Error("level required");
  if (number === undefined || number === null) throw new Error("number required");

  const id = randomUUID();
  const now = new Date().toISOString();

  const t = (title && String(title).trim()) ? String(title).trim() : "(ohne Bezeichnung)";

  db.prepare(`
    INSERT INTO tops (
      id,
      project_id,
      parent_top_id,
      level,
      number,
      title,
      is_hidden,
      removed_at,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
  `).run(
    id,
    projectId,
    parentTopId ?? null,
    Number(level),
    Number(number),
    t,
    now,
    now
  );

  return getTopById(id);
}

/**
 * Reparent + Level + Number in einem Schritt.
 */
function moveTop({ topId, targetParentId, newLevel, newNumber }) {
  const db = initDatabase();

  if (!topId) throw new Error("topId required");
  if (newLevel === undefined || newLevel === null) throw new Error("newLevel required");
  if (newNumber === undefined || newNumber === null) throw new Error("newNumber required");

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE tops
    SET
      parent_top_id = ?,
      level = ?,
      number = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    targetParentId ?? null,
    Number(newLevel),
    Number(newNumber),
    now,
    topId
  );

  return getTopById(topId);
}

function updateTitle({ topId, title }) {
  const db = initDatabase();
  if (!topId) throw new Error("topId required");

  const t = (title && String(title).trim()) ? String(title).trim() : "(ohne Bezeichnung)";
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE tops
    SET title = ?, updated_at = ?
    WHERE id = ?
  `).run(t, now, topId);

  return getTopById(topId);
}

function setHidden({ topId, isHidden }) {
  const db = initDatabase();
  if (!topId) throw new Error("topId required");

  const v = isHidden ? 1 : 0;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE tops
    SET is_hidden = ?, updated_at = ?
    WHERE id = ?
  `).run(v, now, topId);

  return getTopById(topId);
}

function softDeleteTop({ topId }) {
  const db = initDatabase();
  if (!topId) throw new Error("topId required");

  const now = new Date().toISOString();

  const info = db.prepare(`
    UPDATE tops
    SET removed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, topId);

  if (info.changes === 0) {
    throw new Error("TOP konnte nicht gelöscht werden (nicht gefunden?)");
  }

  return { topId, removed_at: now };
}

function markTrashed({ topId }) {
  const db = initDatabase();
  if (!topId) throw new Error("topId required");

  const nowIso = new Date().toISOString();
  const nowTs = Date.now();

  const info = db.prepare(`
    UPDATE tops
    SET is_trashed = 1, trashed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(nowTs, nowIso, topId);

  if (info.changes === 0) {
    throw new Error("TOP konnte nicht in den Papierkorb verschoben werden (nicht gefunden?)");
  }

  return { topId, is_trashed: 1, trashed_at: nowTs };
}

function purgeTrashedByMeeting({ meetingId }) {
  const db = initDatabase();
  if (!meetingId) throw new Error("meetingId required");

  const info = db.prepare(`
    DELETE FROM tops
    WHERE is_trashed = 1
      AND id IN (
        SELECT mt.top_id
        FROM meeting_tops mt
        WHERE mt.meeting_id = ?
      )
  `).run(meetingId);

  return { meetingId, deleted: info.changes };
}

function purgeTrashedGlobal() {
  const db = initDatabase();

  const info = db.prepare(`
    DELETE FROM tops
    WHERE is_trashed = 1
  `).run();

  return { deleted: info.changes };
}

function fixNumberGap({ meetingId, level, parentTopId, fromTopId, toNumber }) {
  const db = initDatabase();
  if (!meetingId) throw new Error("meetingId required");
  if (!fromTopId) throw new Error("fromTopId required");

  const lvl = Math.floor(Number(level));
  const target = Math.floor(Number(toNumber));

  if (!Number.isFinite(lvl) || lvl < 1 || lvl > 4) {
    return { ok: false, errorCode: "INVALID_LEVEL", error: "Ungültiges TOP-Level." };
  }
  if (!Number.isFinite(target) || target < 1) {
    return { ok: false, errorCode: "INVALID_TARGET", error: "Ungültige Zielnummer." };
  }

  const parentId = parentTopId ?? null;

  const tx = db.transaction(() => {
    const rows = db
      .prepare(
        `
        SELECT t.id, t.number
        FROM meeting_tops mt
        JOIN tops t ON t.id = mt.top_id
        WHERE mt.meeting_id = ?
          AND t.removed_at IS NULL
          AND COALESCE(t.is_trashed, 0) = 0
          AND t.level = ?
          AND t.parent_top_id IS ?
      `
      )
      .all(meetingId, lvl, parentId);

    if (!rows.length) {
      return { ok: false, errorCode: "GROUP_EMPTY", error: "Geschwistergruppe nicht gefunden." };
    }

    const numbers = new Set();
    let maxNumber = 0;
    let fromItem = null;

    for (const row of rows) {
      const num = Math.floor(Number(row.number));
      if (Number.isFinite(num) && num > 0) {
        numbers.add(num);
        if (num > maxNumber) maxNumber = num;
      }
      if (String(row.id) === String(fromTopId)) {
        fromItem = { id: row.id, number: num };
      }
    }

    if (!fromItem) {
      return { ok: false, errorCode: "NOT_IN_GROUP", error: "TOP ist nicht in der Gruppe." };
    }
    if (!Number.isFinite(fromItem.number) || fromItem.number < 1) {
      return { ok: false, errorCode: "INVALID_FROM", error: "TOP-Nummer ist ungültig." };
    }
    if (numbers.has(target)) {
      return { ok: false, errorCode: "TARGET_TAKEN", error: "Zielnummer ist belegt." };
    }
    if (fromItem.number !== maxNumber) {
      return { ok: false, errorCode: "NOT_LAST", error: "TOP ist nicht der letzte." };
    }

    const now = new Date().toISOString();
    const info = db
      .prepare(
        `
        UPDATE tops
        SET number = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(target, now, fromTopId);

    if (info.changes === 0) {
      return { ok: false, errorCode: "UPDATE_FAILED", error: "Umnummerierung fehlgeschlagen." };
    }

    return { ok: true };
  });

  return tx();
}

module.exports = {
  getTopById,
  getNextNumber,
  hasChildren,
  createTop,
  moveTop,
  updateTitle,
  setHidden,
  softDeleteTop,
  markTrashed,
  purgeTrashedByMeeting,
  purgeTrashedGlobal,
  fixNumberGap,
};
