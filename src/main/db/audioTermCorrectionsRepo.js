const { randomUUID } = require("crypto");
const { initDatabase } = require("./database");

function _nowIso() {
  return new Date().toISOString();
}

function listByProject(projectId) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");
  return db
    .prepare(
      `
      SELECT *
      FROM audio_term_corrections
      WHERE project_id = ?
        AND is_active = 1
      ORDER BY updated_at DESC
    `
    )
    .all(String(projectId));
}

function findByProjectAndWrongTerm(projectId, wrongTerm) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");
  if (!wrongTerm) throw new Error("wrongTerm required");

  return db
    .prepare(
      `
      SELECT *
      FROM audio_term_corrections
      WHERE project_id = ?
        AND lower(wrong_term) = lower(?)
      LIMIT 1
    `
    )
    .get(String(projectId), String(wrongTerm));
}

function upsertCorrection({ projectId, wrongTerm, correctTerm }) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");
  if (!wrongTerm) throw new Error("wrongTerm required");
  if (!correctTerm) throw new Error("correctTerm required");

  const now = _nowIso();
  const existing = findByProjectAndWrongTerm(projectId, wrongTerm);
  if (existing?.id) {
    db.prepare(
      `
      UPDATE audio_term_corrections
      SET correct_term = ?,
          usage_count = COALESCE(usage_count, 0) + 1,
          is_active = 1,
          updated_at = ?
      WHERE id = ?
    `
    ).run(String(correctTerm), now, existing.id);

    return findByProjectAndWrongTerm(projectId, wrongTerm);
  }

  const id = randomUUID();
  db.prepare(
    `
    INSERT INTO audio_term_corrections (
      id,
      project_id,
      wrong_term,
      correct_term,
      usage_count,
      is_active,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    String(projectId),
    String(wrongTerm),
    String(correctTerm),
    1,
    1,
    now,
    now
  );

  return findByProjectAndWrongTerm(projectId, wrongTerm);
}

module.exports = {
  listByProject,
  findByProjectAndWrongTerm,
  upsertCorrection,
};
