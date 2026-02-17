// src/main/db/appSettingsRepo.js
const { initDatabase } = require("./database.js");

function _db() {
  return initDatabase();
}

function appSettingsGetMany(keys) {
  const db = _db();
  return appSettingsGetManyWithDb(db, keys);
}

function appSettingsGetManyWithDb(db, keys) {
  if (!db) throw new Error("db required");

  const list = Array.isArray(keys)
    ? keys.map((k) => (k == null ? "" : String(k)).trim()).filter(Boolean)
    : [];
  if (list.length === 0) return {};

  const placeholders = list.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT key, value FROM app_settings WHERE key IN (${placeholders})`)
    .all(...list);

  const out = {};
  for (const r of rows || []) out[r.key] = r.value ?? "";

  // fehlende Keys -> "" (UI stabil)
  for (const k of list) {
    if (!(k in out)) out[k] = "";
  }

  return out;
}

function appSettingsSetMany(data) {
  const db = _db();
  const tx = db.transaction((payload) => {
    appSettingsSetManyWithDb(db, payload);
  });
  tx(data);
}

function appSettingsSetManyWithDb(db, data) {
  if (!db) throw new Error("db required");
  const entries = Object.entries(data || {});
  if (entries.length === 0) return;

  const stmt = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, (strftime('%Y-%m-%dT%H:%M:%fZ','now')))
    ON CONFLICT(key)
    DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `);

  for (const [k, v] of entries) {
    const key = (k == null ? "" : String(k)).trim();
    if (!key) continue;
    const val = v == null ? "" : String(v);
    stmt.run(key, val);
  }
}

module.exports = {
  appSettingsGetMany,
  appSettingsSetMany,
  appSettingsGetManyWithDb,
  appSettingsSetManyWithDb,
};
