const { randomUUID } = require("crypto");
const { initDatabase } = require("./database");

function _nowIso() {
  return new Date().toISOString();
}

function getById(transcriptId) {
  const db = initDatabase();
  if (!transcriptId) throw new Error("transcriptId required");

  return db
    .prepare(
      `
      SELECT *
      FROM transcripts
      WHERE id = ?
    `
    )
    .get(transcriptId);
}

function getByAudioImportId(audioImportId) {
  const db = initDatabase();
  if (!audioImportId) throw new Error("audioImportId required");

  return db
    .prepare(
      `
      SELECT *
      FROM transcripts
      WHERE audio_import_id = ?
    `
    )
    .get(audioImportId);
}

function upsertTranscript({
  audioImportId,
  engine = null,
  language = null,
  fullText = "",
  segmentsJson = "[]",
}) {
  const db = initDatabase();
  if (!audioImportId) throw new Error("audioImportId required");

  const existing = getByAudioImportId(audioImportId);
  const now = _nowIso();
  const id = existing?.id || randomUUID();

  db.prepare(
    `
    INSERT INTO transcripts (
      id,
      audio_import_id,
      engine,
      language,
      full_text,
      segments_json,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(audio_import_id) DO UPDATE SET
      engine = excluded.engine,
      language = excluded.language,
      full_text = excluded.full_text,
      segments_json = excluded.segments_json,
      updated_at = excluded.updated_at
  `
  ).run(
    id,
    audioImportId,
    engine === null || engine === undefined ? null : String(engine),
    language === null || language === undefined ? null : String(language),
    fullText === null || fullText === undefined ? "" : String(fullText),
    segmentsJson === null || segmentsJson === undefined ? "[]" : String(segmentsJson),
    existing?.created_at || now,
    now
  );

  return getByAudioImportId(audioImportId);
}

module.exports = {
  getById,
  getByAudioImportId,
  upsertTranscript,
};
