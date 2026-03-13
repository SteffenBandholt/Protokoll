const { initDatabase } = require("./database");

function _normalizeProjectId(projectId) {
  const value = String(projectId || "").trim();
  if (!value) throw new Error("projectId required");
  return value;
}

function _normalizeKeys(keys) {
  if (!Array.isArray(keys)) return [];
  return keys
    .map((key) => String(key || "").trim())
    .filter(Boolean);
}

function getMany(projectId, keys) {
  const db = initDatabase();
  const pid = _normalizeProjectId(projectId);
  const cleanKeys = _normalizeKeys(keys);
  if (!cleanKeys.length) return {};
  const placeholders = cleanKeys.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT key, value FROM project_settings WHERE project_id = ? AND key IN (${placeholders})`)
    .all(pid, ...cleanKeys);
  const out = {};
  for (const row of rows || []) out[row.key] = row.value;
  return out;
}

function setMany(projectId, patch) {
  const db = initDatabase();
  const pid = _normalizeProjectId(projectId);
  const entries = Object.entries(patch || {}).filter(([key]) => String(key || "").trim());
  if (!entries.length) return { changes: 0 };
  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO project_settings (project_id, key, value, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(project_id, key)
    DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  const remove = db.prepare(`DELETE FROM project_settings WHERE project_id = ? AND key = ?`);
  const tx = db.transaction(() => {
    let changes = 0;
    for (const [rawKey, rawValue] of entries) {
      const key = String(rawKey || "").trim();
      const value = rawValue == null ? "" : String(rawValue);
      if (rawValue == null) {
        const info = remove.run(pid, key);
        changes += Number(info?.changes || 0);
        continue;
      }
      const info = upsert.run(pid, key, value, now, now);
      changes += Number(info?.changes || 0);
    }
    return changes;
  });
  return { changes: tx() };
}

module.exports = { getMany, setMany };
