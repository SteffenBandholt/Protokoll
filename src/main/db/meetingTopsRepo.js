// src/main/db/meetingTopsRepo.js

const { initDatabase } = require("./database");

// --- interne Helfer: Spalten dynamisch erkennen (robust gegen Schema-Varianten) ---
let _colsCache = null;
let _topsColsCache = null;

function _getCols(db) {
  if (_colsCache) return _colsCache;
  try {
    const rows = db.prepare("PRAGMA table_info(meeting_tops)").all();
    _colsCache = new Set(rows.map((r) => String(r.name)));
  } catch (_e) {
    _colsCache = new Set();
  }
  return _colsCache;
}

function _getTopsCols(db) {
  if (_topsColsCache) return _topsColsCache;
  try {
    const rows = db.prepare("PRAGMA table_info(tops)").all();
    _topsColsCache = new Set(rows.map((r) => String(r.name)));
  } catch (_e) {
    _topsColsCache = new Set();
  }
  return _topsColsCache;
}

function _hasCol(db, name) {
  return _getCols(db).has(name);
}

function _hasTopCol(db, name) {
  return _getTopsCols(db).has(name);
}

function _nowIso() {
  return new Date().toISOString();
}

function _normBool01(v) {
  return Number(v) === 1 || v === true ? 1 : 0;
}

// ------------------------------------------------------------
// Public Repo API
// ------------------------------------------------------------

function getMeetingTop(meetingId, topId) {
  const db = initDatabase();
  if (!meetingId) throw new Error("meetingId required");
  if (!topId) throw new Error("topId required");

  return db
    .prepare(
      `
      SELECT *
      FROM meeting_tops
      WHERE meeting_id = ? AND top_id = ?
    `
    )
    .get(meetingId, topId);
}

function attachTopToMeeting({
  meetingId,
  topId,
  status = "offen",
  dueDate = null,
  longtext = null,
  isCarriedOver = false,
  completed_in_meeting_id = undefined,
  completedInMeetingId = undefined,

  // optional (neu): Wichtig pro Meeting
  is_important = undefined,
  isImportant = undefined,

  // optional (neu): "angefasst" pro Meeting (damit alte TOPs blau werden können)
  is_touched = undefined,
  isTouched = undefined,

  // optional (neu): Task/Decision Flags
  is_task = undefined,
  isTask = undefined,
  is_decision = undefined,
  isDecision = undefined,

  // optional (neu): Verantwortlich
  responsible_kind = undefined,
  responsible_id = undefined,
  responsible_label = undefined,
  responsibleKind = undefined,
  responsibleId = undefined,
  responsibleLabel = undefined,

  // optional (neu): Ansprechpartner
  contact_kind = undefined,
  contact_person_id = undefined,
  contact_label = undefined,
  contactKind = undefined,
  contactPersonId = undefined,
  contactLabel = undefined,
}) {
  const db = initDatabase();
  if (!meetingId) throw new Error("meetingId required");
  if (!topId) throw new Error("topId required");

  const now = _nowIso();

  const hasCreatedAt = _hasCol(db, "created_at");
  const hasUpdatedAt = _hasCol(db, "updated_at");

  const cols = ["meeting_id", "top_id", "status", "due_date", "longtext", "is_carried_over"];
  const vals = [
    meetingId,
    topId,
    String(status || "offen"),
    dueDate ? String(dueDate) : null,
    longtext ?? null,
    isCarriedOver ? 1 : 0,
  ];

  const hasCompleted = _hasCol(db, "completed_in_meeting_id");
  const completedRaw =
    completed_in_meeting_id !== undefined
      ? completed_in_meeting_id
      : (completedInMeetingId !== undefined ? completedInMeetingId : undefined);
  if (hasCompleted) {
    cols.push("completed_in_meeting_id");
    vals.push(completedRaw === undefined ? null : completedRaw);
  }

  // Wichtig (nur wenn Spalte existiert)
  const hasImp = _hasCol(db, "is_important");
  const impRaw =
    is_important !== undefined ? is_important : (isImportant !== undefined ? isImportant : undefined);
  if (hasImp) {
    cols.push("is_important");
    vals.push(impRaw === undefined ? 0 : _normBool01(impRaw));
  }

  // Touched (nur wenn Spalte existiert)
  const hasTouched = _hasCol(db, "is_touched");
  const touchedRaw =
    is_touched !== undefined ? is_touched : (isTouched !== undefined ? isTouched : undefined);
  if (hasTouched) {
    cols.push("is_touched");
    // Default 0
    vals.push(touchedRaw === undefined ? 0 : _normBool01(touchedRaw));
  }

  // Task/Decision Flags (nur wenn Spalten existieren)
  const hasIsTask = _hasCol(db, "is_task");
  const hasIsDecision = _hasCol(db, "is_decision");
  const isTaskRaw = is_task !== undefined ? is_task : (isTask !== undefined ? isTask : undefined);
  const isDecisionRaw =
    is_decision !== undefined ? is_decision : (isDecision !== undefined ? isDecision : undefined);
  if (hasIsTask) {
    cols.push("is_task");
    vals.push(isTaskRaw === undefined ? 0 : _normBool01(isTaskRaw));
  }
  if (hasIsDecision) {
    cols.push("is_decision");
    vals.push(isDecisionRaw === undefined ? 0 : _normBool01(isDecisionRaw));
  }

  // Verantwortlich (nur wenn Spalten existieren)
  const hasRK = _hasCol(db, "responsible_kind");
  const hasRI = _hasCol(db, "responsible_id");
  const hasRL = _hasCol(db, "responsible_label");
  const rk =
    responsible_kind !== undefined
      ? responsible_kind
      : (responsibleKind !== undefined ? responsibleKind : undefined);
  const ri =
    responsible_id !== undefined ? responsible_id : (responsibleId !== undefined ? responsibleId : undefined);
  const rl =
    responsible_label !== undefined
      ? responsible_label
      : (responsibleLabel !== undefined ? responsibleLabel : undefined);

  if (hasRK) {
    cols.push("responsible_kind");
    vals.push(rk === undefined ? null : rk);
  }
  if (hasRI) {
    cols.push("responsible_id");
    vals.push(ri === undefined ? null : ri);
  }
  if (hasRL) {
    cols.push("responsible_label");
    vals.push(rl === undefined ? null : rl);
  }

  // Ansprechpartner (nur wenn Spalten existieren)
  const hasCK = _hasCol(db, "contact_kind");
  const hasCP = _hasCol(db, "contact_person_id");
  const hasCL = _hasCol(db, "contact_label");

  const ck = contact_kind !== undefined ? contact_kind : (contactKind !== undefined ? contactKind : undefined);
  const cp =
    contact_person_id !== undefined
      ? contact_person_id
      : (contactPersonId !== undefined ? contactPersonId : undefined);
  const cl =
    contact_label !== undefined ? contact_label : (contactLabel !== undefined ? contactLabel : undefined);

  if (hasCK) {
    cols.push("contact_kind");
    vals.push(ck === undefined ? null : ck);
  }
  if (hasCP) {
    cols.push("contact_person_id");
    vals.push(cp === undefined ? null : cp);
  }
  if (hasCL) {
    cols.push("contact_label");
    vals.push(cl === undefined ? null : cl);
  }

  if (hasCreatedAt) {
    cols.push("created_at");
    vals.push(now);
  }
  if (hasUpdatedAt) {
    cols.push("updated_at");
    vals.push(now);
  }

  const placeholders = cols.map(() => "?").join(", ");

  db.prepare(
    `
    INSERT OR IGNORE INTO meeting_tops (${cols.join(", ")})
    VALUES (${placeholders})
  `
  ).run(...vals);

  return getMeetingTop(meetingId, topId);
}

function updateMeetingTop({
  meetingId,
  topId,
  status,
  dueDate,
  longtext,
  completed_in_meeting_id = undefined,
  completedInMeetingId = undefined,

  // optional (neu): Wichtig pro Meeting
  is_important = undefined,
  isImportant = undefined,

  // optional (neu): "angefasst" pro Meeting
  // (undefined = nicht anfassen; 0/1 = explizit setzen)
  is_touched = undefined,
  isTouched = undefined,

  // optional (neu): Task/Decision Flags
  is_task = undefined,
  isTask = undefined,
  is_decision = undefined,
  isDecision = undefined,

  // optional (neu): Verantwortlich
  responsible_kind = undefined,
  responsible_id = undefined,
  responsible_label = undefined,
  responsibleKind = undefined,
  responsibleId = undefined,
  responsibleLabel = undefined,

  // optional (neu): Ansprechpartner
  contact_kind = undefined,
  contact_person_id = undefined,
  contact_label = undefined,
  contactKind = undefined,
  contactPersonId = undefined,
  contactLabel = undefined,
}) {
  const db = initDatabase();
  if (!meetingId) throw new Error("meetingId required");
  if (!topId) throw new Error("topId required");

  const hasUpdatedAt = _hasCol(db, "updated_at");
  const now = _nowIso();

  const sets = ["status = ?", "due_date = ?", "longtext = ?"];
  const vals = [String(status ?? "offen"), dueDate ? String(dueDate) : null, longtext ?? null];

  // Wichtig nur updaten, wenn:
  // - Spalte existiert
  // - und Wert explizit übergeben wurde (undefined = nicht anfassen)
  const hasImp = _hasCol(db, "is_important");
  const impRaw =
    is_important !== undefined ? is_important : (isImportant !== undefined ? isImportant : undefined);
  if (hasImp && impRaw !== undefined) {
    sets.push("is_important = ?");
    vals.push(_normBool01(impRaw));
  }

  // Touched nur updaten, wenn:
  // - Spalte existiert
  // - und Wert explizit übergeben wurde (undefined = nicht anfassen)
  const hasTouched = _hasCol(db, "is_touched");
  const touchedRaw =
    is_touched !== undefined ? is_touched : (isTouched !== undefined ? isTouched : undefined);
  if (hasTouched && touchedRaw !== undefined) {
    sets.push("is_touched = ?");
    vals.push(_normBool01(touchedRaw));
  }

  // Task/Decision Flags nur updaten, wenn:
  // - Spalte existiert
  // - und Wert explizit übergeben wurde (undefined = nicht anfassen)
  const hasIsTask = _hasCol(db, "is_task");
  const hasIsDecision = _hasCol(db, "is_decision");
  const isTaskRaw = is_task !== undefined ? is_task : (isTask !== undefined ? isTask : undefined);
  const isDecisionRaw =
    is_decision !== undefined ? is_decision : (isDecision !== undefined ? isDecision : undefined);
  if (hasIsTask && isTaskRaw !== undefined) {
    sets.push("is_task = ?");
    vals.push(_normBool01(isTaskRaw));
  }
  if (hasIsDecision && isDecisionRaw !== undefined) {
    sets.push("is_decision = ?");
    vals.push(_normBool01(isDecisionRaw));
  }

  const hasCompleted = _hasCol(db, "completed_in_meeting_id");
  const completedRaw =
    completed_in_meeting_id !== undefined
      ? completed_in_meeting_id
      : (completedInMeetingId !== undefined ? completedInMeetingId : undefined);
  if (hasCompleted && completedRaw !== undefined) {
    sets.push("completed_in_meeting_id = ?");
    vals.push(completedRaw);
  }

  // Verantwortlich nur updaten, wenn:
  // - Spalten existieren
  // - und Wert explizit übergeben wurde (undefined = nicht anfassen; null = löschen)
  const hasRK = _hasCol(db, "responsible_kind");
  const hasRI = _hasCol(db, "responsible_id");
  const hasRL = _hasCol(db, "responsible_label");

  const rk =
    responsible_kind !== undefined
      ? responsible_kind
      : (responsibleKind !== undefined ? responsibleKind : undefined);
  const ri =
    responsible_id !== undefined ? responsible_id : (responsibleId !== undefined ? responsibleId : undefined);
  const rl =
    responsible_label !== undefined
      ? responsible_label
      : (responsibleLabel !== undefined ? responsibleLabel : undefined);

  if (hasRK && rk !== undefined) {
    sets.push("responsible_kind = ?");
    vals.push(rk);
  }
  if (hasRI && ri !== undefined) {
    sets.push("responsible_id = ?");
    vals.push(ri);
  }
  if (hasRL && rl !== undefined) {
    sets.push("responsible_label = ?");
    vals.push(rl);
  }

  // Ansprechpartner nur updaten, wenn:
  // - Spalten existieren
  // - und Wert explizit übergeben wurde (undefined = nicht anfassen; null = löschen)
  const hasCK = _hasCol(db, "contact_kind");
  const hasCP = _hasCol(db, "contact_person_id");
  const hasCL = _hasCol(db, "contact_label");

  const ck = contact_kind !== undefined ? contact_kind : (contactKind !== undefined ? contactKind : undefined);
  const cp =
    contact_person_id !== undefined
      ? contact_person_id
      : (contactPersonId !== undefined ? contactPersonId : undefined);
  const cl =
    contact_label !== undefined ? contact_label : (contactLabel !== undefined ? contactLabel : undefined);

  if (hasCK && ck !== undefined) {
    sets.push("contact_kind = ?");
    vals.push(ck);
  }
  if (hasCP && cp !== undefined) {
    sets.push("contact_person_id = ?");
    vals.push(cp);
  }
  if (hasCL && cl !== undefined) {
    sets.push("contact_label = ?");
    vals.push(cl);
  }

  if (hasUpdatedAt) {
    sets.push("updated_at = ?");
    vals.push(now);
  }

  vals.push(meetingId, topId);

  const info = db
    .prepare(
      `
      UPDATE meeting_tops
      SET ${sets.join(", ")}
      WHERE meeting_id = ? AND top_id = ?
    `
    )
    .run(...vals);

  return { changed: info.changes, row: getMeetingTop(meetingId, topId) };
}

function listJoinedByMeeting(meetingId) {
  const db = initDatabase();
  if (!meetingId) throw new Error("meetingId required");

  // Wichtig (optional)
  const impSel = _hasCol(db, "is_important") ? "mt.is_important" : "0";

  // Touched (optional)
  const touchedSel = _hasCol(db, "is_touched") ? "mt.is_touched" : "0";

  // Task/Decision (optional)
  const isTaskSel = _hasCol(db, "is_task") ? "mt.is_task" : "0";
  const isDecisionSel = _hasCol(db, "is_decision") ? "mt.is_decision" : "0";

  // Completed-in (optional)
  const completedSel = _hasCol(db, "completed_in_meeting_id")
    ? "mt.completed_in_meeting_id"
    : "NULL AS completed_in_meeting_id";

  // Verantwortlich (optional)
  const rkSel = _hasCol(db, "responsible_kind") ? "mt.responsible_kind" : "NULL AS responsible_kind";
  const riSel = _hasCol(db, "responsible_id") ? "mt.responsible_id" : "NULL AS responsible_id";
  const rlSel = _hasCol(db, "responsible_label") ? "mt.responsible_label" : "NULL AS responsible_label";

  // Ansprechpartner (optional)
  const ckSel = _hasCol(db, "contact_kind") ? "mt.contact_kind" : "NULL AS contact_kind";
  const cpSel = _hasCol(db, "contact_person_id") ? "mt.contact_person_id" : "NULL AS contact_person_id";
  const clSel = _hasCol(db, "contact_label") ? "mt.contact_label" : "NULL AS contact_label";

  // Änderungszeitpunkt (optional)
  const updatedSel = _hasCol(db, "updated_at") ? "mt.updated_at" : "NULL AS updated_at";

  // TOP angelegt am (optional, aus tops.created_at)
  const topCreatedSel = _hasTopCol(db, "created_at")
    ? "t.created_at AS top_created_at"
    : "NULL AS top_created_at";
  const trashedWhere = _hasTopCol(db, "is_trashed") ? "AND COALESCE(t.is_trashed, 0) = 0" : "";

  // Snapshot-Spalten (optional)
  const f = (col) => (_hasCol(db, col) ? `mt.${col}` : `NULL AS ${col}`);

  return db
    .prepare(
      `
      SELECT
        t.id,
        t.project_id,
        t.parent_top_id,
        t.level,
        t.number,
        t.title,
        t.is_hidden,
        ${topCreatedSel},

        mt.meeting_id,
        mt.status,
        mt.due_date,
        mt.longtext,
        mt.is_carried_over,
        ${impSel} AS is_important,
        ${touchedSel} AS is_touched,
        ${isTaskSel} AS is_task,
        ${isDecisionSel} AS is_decision,
        ${updatedSel},
        ${completedSel} AS completed_in_meeting_id,

        ${rkSel},
        ${riSel},
        ${rlSel},
        ${ckSel},
        ${cpSel},
        ${clSel},

        ${f("frozen_at")},
        ${f("frozen_title")},
        ${f("frozen_is_hidden")},
        ${f("frozen_parent_top_id")},
        ${f("frozen_level")},
        ${f("frozen_number")},
        ${f("frozen_display_number")},
        ${f("frozen_ampel_color")},
        ${f("frozen_ampel_reason")}
      FROM meeting_tops mt
      JOIN tops t ON t.id = mt.top_id
      WHERE mt.meeting_id = ?
        AND t.removed_at IS NULL
        ${trashedWhere}
    `
    )
    .all(meetingId);
}

function listLatestByProject(projectId) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");

  // Wichtig (optional)
  const impSel = _hasCol(db, "is_important") ? "mt.is_important" : "0";

  // Touched (optional)
  const touchedSel = _hasCol(db, "is_touched") ? "mt.is_touched" : "0";

  // Task/Decision (optional)
  const isTaskSel = _hasCol(db, "is_task") ? "mt.is_task" : "0";
  const isDecisionSel = _hasCol(db, "is_decision") ? "mt.is_decision" : "0";

  // Completed-in (optional)
  const completedSel = _hasCol(db, "completed_in_meeting_id")
    ? "mt.completed_in_meeting_id"
    : "NULL AS completed_in_meeting_id";

  // Verantwortlich (optional)
  const rkSel = _hasCol(db, "responsible_kind") ? "mt.responsible_kind" : "NULL AS responsible_kind";
  const riSel = _hasCol(db, "responsible_id") ? "mt.responsible_id" : "NULL AS responsible_id";
  const rlSel = _hasCol(db, "responsible_label") ? "mt.responsible_label" : "NULL AS responsible_label";

  // Ansprechpartner (optional)
  const ckSel = _hasCol(db, "contact_kind") ? "mt.contact_kind" : "NULL AS contact_kind";
  const cpSel = _hasCol(db, "contact_person_id") ? "mt.contact_person_id" : "NULL AS contact_person_id";
  const clSel = _hasCol(db, "contact_label") ? "mt.contact_label" : "NULL AS contact_label";

  // TOP angelegt am (optional, aus tops.created_at)
  const topCreatedSel = _hasTopCol(db, "created_at")
    ? "t.created_at AS top_created_at"
    : "NULL AS top_created_at";
  const trashedWhere = _hasTopCol(db, "is_trashed") ? "AND COALESCE(t.is_trashed, 0) = 0" : "";

  // Snapshot-Spalten (optional)
  const f = (col) => (_hasCol(db, col) ? `mt.${col}` : `NULL AS ${col}`);

  const baseRows = db
    .prepare(
      `
      SELECT
        t.id,
        t.project_id,
        t.parent_top_id,
        t.level,
        t.number,
        t.title,
        t.is_hidden,
        ${topCreatedSel}
      FROM tops t
      WHERE t.project_id = ?
        AND t.removed_at IS NULL
        ${trashedWhere}
    `
    )
    .all(projectId);

  const mtRows = db
    .prepare(
      `
      SELECT
        mt.top_id,
        mt.meeting_id,
        mt.status,
        mt.due_date,
        mt.longtext,
        mt.is_carried_over,
        ${impSel} AS is_important,
        ${touchedSel} AS is_touched,
        ${isTaskSel} AS is_task,
        ${isDecisionSel} AS is_decision,
        ${completedSel} AS completed_in_meeting_id,

        ${rkSel},
        ${riSel},
        ${rlSel},
        ${ckSel},
        ${cpSel},
        ${clSel},

        ${f("frozen_at")},
        ${f("frozen_title")},
        ${f("frozen_is_hidden")},
        ${f("frozen_parent_top_id")},
        ${f("frozen_level")},
        ${f("frozen_number")},
        ${f("frozen_display_number")},
        ${f("frozen_ampel_color")},
        ${f("frozen_ampel_reason")}
      FROM meeting_tops mt
      JOIN (
        SELECT mt.top_id, MAX(mt.updated_at) AS max_updated
        FROM meeting_tops mt
        JOIN tops t ON t.id = mt.top_id
        WHERE t.project_id = ?
        GROUP BY mt.top_id
      ) latest ON latest.top_id = mt.top_id AND latest.max_updated = mt.updated_at
    `
    )
    .all(projectId);

  const mtById = new Map();
  for (const row of mtRows) {
    const topId = row.top_id;
    const { top_id: _ignore, ...rest } = row;
    mtById.set(topId, rest);
  }

  return baseRows.map((t) => ({
    ...t,
    ...(mtById.get(t.id) || {}),
  }));
}

function deleteByTopId(topId) {
  const db = initDatabase();
  if (!topId) throw new Error("topId required");

  const info = db
    .prepare(
      `
    DELETE FROM meeting_tops
    WHERE top_id = ?
  `
    )
    .run(topId);

  return { deleted: info.changes };
}

/**
 * Übernimmt alle TOPs aus einem alten Meeting in ein neues Meeting
 * und markiert sie als "übernommen" (schwarz).
 *
 * Unterstützt beide Signaturen:
 * - carryOverFromMeeting({ fromMeetingId, toMeetingId })
 * - carryOverFromMeeting(fromMeetingId, toMeetingId)
 */
function carryOverFromMeeting(arg1, arg2) {
  const db = initDatabase();

  let fromMeetingId;
  let toMeetingId;

  if (typeof arg1 === "object" && arg1) {
    fromMeetingId = arg1.fromMeetingId;
    toMeetingId = arg1.toMeetingId;
  } else {
    fromMeetingId = arg1;
    toMeetingId = arg2;
  }

  if (!fromMeetingId) throw new Error("fromMeetingId required");
  if (!toMeetingId) throw new Error("toMeetingId required");

  const now = _nowIso();

  const hasCreatedAt = _hasCol(db, "created_at");
  const hasUpdatedAt = _hasCol(db, "updated_at");

  const hasImp = _hasCol(db, "is_important");
  const hasTouched = _hasCol(db, "is_touched");
  const hasIsTask = _hasCol(db, "is_task");
  const hasIsDecision = _hasCol(db, "is_decision");
  const hasCompleted = _hasCol(db, "completed_in_meeting_id");

  const hasRK = _hasCol(db, "responsible_kind");
  const hasRI = _hasCol(db, "responsible_id");
  const hasRL = _hasCol(db, "responsible_label");
  const hasCK = _hasCol(db, "contact_kind");
  const hasCP = _hasCol(db, "contact_person_id");
  const hasCL = _hasCol(db, "contact_label");

  // Zielspalten dynamisch
  const cols = ["meeting_id", "top_id", "status", "due_date", "longtext", "is_carried_over"];
  if (hasImp) cols.push("is_important");
  if (hasTouched) cols.push("is_touched");
  if (hasIsTask) cols.push("is_task");
  if (hasIsDecision) cols.push("is_decision");
  if (hasCompleted) cols.push("completed_in_meeting_id");
  if (hasRK) cols.push("responsible_kind");
  if (hasRI) cols.push("responsible_id");
  if (hasRL) cols.push("responsible_label");
  if (hasCK) cols.push("contact_kind");
  if (hasCP) cols.push("contact_person_id");
  if (hasCL) cols.push("contact_label");
  if (hasCreatedAt) cols.push("created_at");
  if (hasUpdatedAt) cols.push("updated_at");

  const selectParts = ["? AS meeting_id", "top_id", "status", "due_date", "longtext", "1 AS is_carried_over"];

  // Wichtig: übernehmen
  if (hasImp) selectParts.push("is_important");

  // Touched: im neuen Meeting wieder 0 (Flag kommt über changed_at/updated_at)
  if (hasTouched) selectParts.push("0 AS is_touched");
  if (hasIsTask) selectParts.push("is_task");
  if (hasIsDecision) selectParts.push("is_decision");
  if (hasCompleted) selectParts.push("completed_in_meeting_id");

  if (hasRK) selectParts.push("responsible_kind");
  if (hasRI) selectParts.push("responsible_id");
  if (hasRL) selectParts.push("responsible_label");
  if (hasCK) selectParts.push("contact_kind");
  if (hasCP) selectParts.push("contact_person_id");
  if (hasCL) selectParts.push("contact_label");

  const params = [toMeetingId];

  if (hasCreatedAt) {
    selectParts.push("? AS created_at");
    params.push(now);
  }
  if (hasUpdatedAt) {
    selectParts.push("? AS updated_at");
    params.push(now);
  }

  params.push(fromMeetingId);

  const sql = `
    INSERT OR IGNORE INTO meeting_tops (${cols.join(", ")})
    SELECT ${selectParts.join(", ")}
    FROM meeting_tops
    WHERE meeting_id = ?
  `;

  const info = db.prepare(sql).run(...params);
  return { inserted: info.changes };
}

/**
 * Snapshot beim Schließen:
 * Aktuell minimal (damit Close nicht crasht).
 * Falls es Spalten wie snapshot_at gibt, werden sie gesetzt.
 */
function snapshotMeetingTops(meetingId) {
  const db = initDatabase();
  if (!meetingId) throw new Error("meetingId required");

  const hasSnapshotAt = _hasCol(db, "snapshot_at");
  if (!hasSnapshotAt) {
    // No-op: wichtig ist, dass die Funktion existiert (Close darf nicht crashen)
    const row = db
      .prepare(`SELECT COUNT(*) AS n FROM meeting_tops WHERE meeting_id = ?`)
      .get(meetingId);
    return { ok: true, changed: 0, count: row?.n || 0 };
  }

  const now = _nowIso();
  const info = db
    .prepare(
      `
      UPDATE meeting_tops
      SET snapshot_at = ?
      WHERE meeting_id = ?
    `
    )
    .run(now, meetingId);

  return { ok: true, changed: info.changes };
}

module.exports = {
  getMeetingTop,
  attachTopToMeeting,
  updateMeetingTop,
  listJoinedByMeeting,
  listLatestByProject,
  deleteByTopId,
  carryOverFromMeeting,
  snapshotMeetingTops,
};
