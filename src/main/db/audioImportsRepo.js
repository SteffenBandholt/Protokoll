const path = require("path");
const { randomUUID } = require("crypto");
const { initDatabase } = require("./database");

function _nowIso() {
  return new Date().toISOString();
}

function getById(audioImportId) {
  const db = initDatabase();
  if (!audioImportId) throw new Error("audioImportId required");

  return db
    .prepare(
      `
      SELECT *
      FROM audio_imports
      WHERE id = ?
    `
    )
    .get(audioImportId);
}

function listByMeeting(meetingId) {
  const db = initDatabase();
  if (!meetingId) throw new Error("meetingId required");

  return db
    .prepare(
      `
      SELECT *
      FROM audio_imports
      WHERE meeting_id = ?
      ORDER BY created_at DESC, id DESC
    `
    )
    .all(meetingId);
}

function createImport({
  meetingId,
  projectId,
  filePath,
  originalFileName,
  mimeType = null,
  processingMode = "review",
  status = "imported",
}) {
  const db = initDatabase();
  if (!meetingId) throw new Error("meetingId required");
  if (!projectId) throw new Error("projectId required");
  if (!filePath) throw new Error("filePath required");

  const id = randomUUID();
  const now = _nowIso();
  const fileName = String(originalFileName || "").trim() || path.basename(String(filePath));

  db.prepare(
    `
    INSERT INTO audio_imports (
      id,
      meeting_id,
      project_id,
      file_path,
      original_file_name,
      mime_type,
      processing_mode,
      status,
      error_message,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `
  ).run(
    id,
    meetingId,
    projectId,
    String(filePath),
    fileName,
    mimeType ? String(mimeType) : null,
    String(processingMode || "review"),
    String(status || "imported"),
    now,
    now
  );

  return getById(id);
}

function updateStatus({ audioImportId, status, errorMessage = undefined }) {
  const db = initDatabase();
  if (!audioImportId) throw new Error("audioImportId required");
  if (!status) throw new Error("status required");

  const sets = ["status = ?", "updated_at = ?"];
  const params = [String(status), _nowIso()];

  if (errorMessage !== undefined) {
    sets.push("error_message = ?");
    params.push(errorMessage === null || errorMessage === undefined ? null : String(errorMessage));
  }

  params.push(audioImportId);

  db.prepare(
    `
    UPDATE audio_imports
    SET ${sets.join(", ")}
    WHERE id = ?
  `
  ).run(...params);

  return getById(audioImportId);
}

module.exports = {
  getById,
  listByMeeting,
  createImport,
  updateStatus,
};
