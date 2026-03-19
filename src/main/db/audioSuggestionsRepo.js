const { randomUUID } = require("crypto");
const { initDatabase } = require("./database");

function _nowIso() {
  return new Date().toISOString();
}

function getById(suggestionId) {
  const db = initDatabase();
  if (!suggestionId) throw new Error("suggestionId required");

  return db
    .prepare(
      `
      SELECT
        s.*,
        target.title AS target_top_title,
        target.number AS target_top_number,
        parent.title AS parent_top_title,
        parent.number AS parent_top_number
      FROM audio_suggestions s
      LEFT JOIN tops target ON target.id = s.target_top_id
      LEFT JOIN tops parent ON parent.id = s.parent_top_id
      WHERE s.id = ?
    `
    )
    .get(suggestionId);
}

function listByMeeting(meetingId, { status } = {}) {
  const db = initDatabase();
  if (!meetingId) throw new Error("meetingId required");

  const params = [meetingId];
  let sql = `
    SELECT
      s.*,
      target.title AS target_top_title,
      target.number AS target_top_number,
      parent.title AS parent_top_title,
      parent.number AS parent_top_number
    FROM audio_suggestions s
    LEFT JOIN tops target ON target.id = s.target_top_id
    LEFT JOIN tops parent ON parent.id = s.parent_top_id
    WHERE s.meeting_id = ?
  `;

  if (status) {
    sql += " AND status = ?";
    params.push(String(status));
  }

  sql += " ORDER BY created_at DESC, id DESC";

  return db.prepare(sql).all(...params);
}

function listByAudioImport(audioImportId, { status } = {}) {
  const db = initDatabase();
  if (!audioImportId) throw new Error("audioImportId required");

  const params = [audioImportId];
  let sql = `
    SELECT
      s.*,
      target.title AS target_top_title,
      target.number AS target_top_number,
      parent.title AS parent_top_title,
      parent.number AS parent_top_number
    FROM audio_suggestions s
    LEFT JOIN tops target ON target.id = s.target_top_id
    LEFT JOIN tops parent ON parent.id = s.parent_top_id
    WHERE s.audio_import_id = ?
  `;

  if (status) {
    sql += " AND status = ?";
    params.push(String(status));
  }

  sql += " ORDER BY created_at DESC, id DESC";

  return db.prepare(sql).all(...params);
}

function createSuggestion({
  audioImportId,
  meetingId,
  projectId,
  type,
  targetTopId = null,
  parentTopId = null,
  titleSuggestion = null,
  textSuggestion = null,
  sourceExcerpt = null,
  confidence = null,
  status = "pending",
  mappingReason = null,
}) {
  const db = initDatabase();
  if (!audioImportId) throw new Error("audioImportId required");
  if (!meetingId) throw new Error("meetingId required");
  if (!projectId) throw new Error("projectId required");
  if (!type) throw new Error("type required");

  const id = randomUUID();
  const now = _nowIso();

  db.prepare(
    `
    INSERT INTO audio_suggestions (
      id,
      audio_import_id,
      meeting_id,
      project_id,
      type,
      target_top_id,
      parent_top_id,
      title_suggestion,
      text_suggestion,
      source_excerpt,
      confidence,
      status,
      mapping_reason,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    audioImportId,
    meetingId,
    projectId,
    String(type),
    targetTopId === null || targetTopId === undefined ? null : String(targetTopId),
    parentTopId === null || parentTopId === undefined ? null : String(parentTopId),
    titleSuggestion === null || titleSuggestion === undefined ? null : String(titleSuggestion),
    textSuggestion === null || textSuggestion === undefined ? null : String(textSuggestion),
    sourceExcerpt === null || sourceExcerpt === undefined ? null : String(sourceExcerpt),
    confidence === null || confidence === undefined ? null : Number(confidence),
    String(status || "pending"),
    mappingReason === null || mappingReason === undefined ? null : String(mappingReason),
    now,
    now
  );

  return getById(id);
}

function createSuggestions(items) {
  const db = initDatabase();
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];

  const tx = db.transaction((rows) => rows.map((row) => createSuggestion(row)));
  return tx(list);
}

function deletePendingByAudioImport(audioImportId) {
  const db = initDatabase();
  if (!audioImportId) throw new Error("audioImportId required");

  const info = db
    .prepare(
      `
      DELETE FROM audio_suggestions
      WHERE audio_import_id = ?
        AND status = 'pending'
    `
    )
    .run(audioImportId);

  return { deleted: info.changes };
}

function updateStatus({ suggestionId, status }) {
  const db = initDatabase();
  if (!suggestionId) throw new Error("suggestionId required");
  if (!status) throw new Error("status required");

  db.prepare(
    `
    UPDATE audio_suggestions
    SET status = ?, updated_at = ?
    WHERE id = ?
  `
  ).run(String(status), _nowIso(), suggestionId);

  return getById(suggestionId);
}

function _getStatusLabel(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "applied") return "bereits übernommen";
  if (normalized === "rejected") return "bereits verworfen";
  if (normalized) return `nicht mehr im Status pending (${normalized})`;
  return "nicht mehr im Status pending";
}

function _throwPendingTransitionError(suggestionId, actionLabel) {
  const current = getById(suggestionId);
  if (!current) throw new Error("Vorschlag nicht gefunden");
  throw new Error(`Vorschlag kann nicht ${actionLabel} werden: ${_getStatusLabel(current.status)}.`);
}

function markApplied({
  suggestionId,
  appliedTargetTopId = null,
  appliedParentTopId = null,
  usedOverride = false,
}) {
  const db = initDatabase();
  if (!suggestionId) throw new Error("suggestionId required");

  const now = _nowIso();
  const info = db
    .prepare(
      `
      UPDATE audio_suggestions
      SET
        status = 'applied',
        applied_at = ?,
        rejected_at = NULL,
        applied_target_top_id = ?,
        applied_parent_top_id = ?,
        applied_with_override = ?,
        apply_error = NULL,
        updated_at = ?
      WHERE id = ?
        AND status = 'pending'
    `
    )
    .run(
      now,
      appliedTargetTopId === null || appliedTargetTopId === undefined
        ? null
        : String(appliedTargetTopId),
      appliedParentTopId === null || appliedParentTopId === undefined
        ? null
        : String(appliedParentTopId),
      usedOverride ? 1 : 0,
      now,
      suggestionId
    );

  if (!info.changes) {
    _throwPendingTransitionError(suggestionId, "übernommen");
  }

  return getById(suggestionId);
}

function markRejected({ suggestionId }) {
  const db = initDatabase();
  if (!suggestionId) throw new Error("suggestionId required");

  const now = _nowIso();
  const info = db
    .prepare(
      `
      UPDATE audio_suggestions
      SET
        status = 'rejected',
        rejected_at = ?,
        apply_error = NULL,
        updated_at = ?
      WHERE id = ?
        AND status = 'pending'
    `
    )
    .run(now, now, suggestionId);

  if (!info.changes) {
    _throwPendingTransitionError(suggestionId, "verworfen");
  }

  return getById(suggestionId);
}

function setApplyError({ suggestionId, errorMessage }) {
  const db = initDatabase();
  if (!suggestionId) throw new Error("suggestionId required");

  db.prepare(
    `
    UPDATE audio_suggestions
    SET
      apply_error = ?,
      updated_at = ?
    WHERE id = ?
  `
  ).run(
    errorMessage === null || errorMessage === undefined ? null : String(errorMessage),
    _nowIso(),
    suggestionId
  );

  return getById(suggestionId);
}

module.exports = {
  getById,
  listByMeeting,
  listByAudioImport,
  createSuggestion,
  createSuggestions,
  deletePendingByAudioImport,
  updateStatus,
  markApplied,
  markRejected,
  setApplyError,
};
