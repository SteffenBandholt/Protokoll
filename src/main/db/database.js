// src/main/db/database.js

const Database = require("better-sqlite3");
const fs = require("fs");
const { app } = require("electron");
const path = require("path");

let db;

function getDbPaths() {
  const userDataPath = app.getPath("userData");
  return {
    userDataPath,
    activeDbPath: path.join(userDataPath, "app.db"),
    backupPath: path.join(userDataPath, "app.db.bak"),
    beforeImportBackupPath: path.join(userDataPath, "app.db.before-import.bak"),
    legacyDbPath: path.join(__dirname, "app.db"),
    legacyImportDir: path.join(userDataPath, "legacy-import"),
    legacyImportPath: path.join(userDataPath, "legacy-import", "app_legacy.db"),
  };
}

function getFileStatOrEmpty(filePath) {
  try {
    const s = fs.statSync(filePath);
    return { exists: true, size: s.size, mtimeMs: s.mtimeMs };
  } catch {
    return { exists: false, size: 0, mtimeMs: 0 };
  }
}

function resolveLegacySourcePath(paths = getDbPaths()) {
  if (fs.existsSync(paths.legacyImportPath)) return paths.legacyImportPath;
  if (fs.existsSync(paths.legacyDbPath)) return paths.legacyDbPath;
  return null;
}

function isDbLikelyEmpty(dbPath, compareLegacyPath = null) {
  if (!dbPath || !fs.existsSync(dbPath)) return true;
  const dbStat = getFileStatOrEmpty(dbPath);

  let probeDb = null;
  try {
    probeDb = new Database(dbPath, { readonly: true, fileMustExist: true });
    const coreTables = ["projects", "firms", "meetings", "tops"];
    const placeholders = coreTables.map(() => "?").join(",");
    const present = probeDb
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN (${placeholders})`)
      .all(...coreTables);

    if (present.length < coreTables.length) return true;

    const projectCount = probeDb.prepare(`SELECT COUNT(*) AS c FROM projects`).get()?.c || 0;
    const firmsCount = probeDb.prepare(`SELECT COUNT(*) AS c FROM firms`).get()?.c || 0;
    const meetingCount = probeDb.prepare(`SELECT COUNT(*) AS c FROM meetings`).get()?.c || 0;
    const topsCount = probeDb.prepare(`SELECT COUNT(*) AS c FROM tops`).get()?.c || 0;
    const totalRows = projectCount + firmsCount + meetingCount + topsCount;
    if (totalRows > 0) return false;

    if (compareLegacyPath && fs.existsSync(compareLegacyPath)) {
      const legacyStat = getFileStatOrEmpty(compareLegacyPath);
      if (legacyStat.size > 0 && dbStat.size < Math.floor(legacyStat.size * 0.5)) return true;
    }
    return true;
  } catch (err) {
    console.warn("[db] could not inspect active db", err?.message || err);
    if (compareLegacyPath && fs.existsSync(compareLegacyPath)) {
      const legacyStat = getFileStatOrEmpty(compareLegacyPath);
      if (legacyStat.size > 0 && dbStat.size < Math.floor(legacyStat.size * 0.5)) return true;
    }
    return dbStat.size < 8192;
  } finally {
    if (probeDb) {
      try {
        probeDb.close();
      } catch (_) {
        // ignore close errors for probe connection
      }
    }
  }
}

function ensureLegacyImportCopy(paths = getDbPaths()) {
  if (app.isPackaged || process.env.NODE_ENV === "production") return;
  if (!fs.existsSync(paths.legacyDbPath)) return;
  fs.mkdirSync(paths.legacyImportDir, { recursive: true });
  if (!fs.existsSync(paths.legacyImportPath)) {
    fs.copyFileSync(paths.legacyDbPath, paths.legacyImportPath);
    console.warn("[db] legacy database copied for manual import:", paths.legacyImportPath);
  }
}

function closeDatabase() {
  if (!db) return;
  try {
    db.close();
  } finally {
    db = null;
  }
}

function importLegacyIntoActive() {
  const paths = getDbPaths();
  const sourcePath = resolveLegacySourcePath(paths);
  if (!sourcePath) {
    return { ok: false, error: "Keine Legacy-Datenbank verfuegbar." };
  }

  try {
    closeDatabase();
    fs.mkdirSync(paths.userDataPath, { recursive: true });
    if (fs.existsSync(paths.activeDbPath)) {
      fs.copyFileSync(paths.activeDbPath, paths.beforeImportBackupPath);
      console.log("[db] backup created", paths.beforeImportBackupPath);
    }
    fs.copyFileSync(sourcePath, paths.activeDbPath);
    console.log("[db] legacy import applied", sourcePath, "->", paths.activeDbPath);
    return { ok: true, sourcePath, activeDbPath: paths.activeDbPath };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

function getDatabaseDiagnostics() {
  const paths = getDbPaths();
  ensureLegacyImportCopy(paths);
  const legacySourcePath = resolveLegacySourcePath(paths);
  const activeLikelyEmpty = isDbLikelyEmpty(paths.activeDbPath, legacySourcePath);
  return {
    dbPath: paths.activeDbPath,
    backupPath: paths.backupPath,
    legacyDbPath: paths.legacyDbPath,
    legacyImportPath: paths.legacyImportPath,
    db: getFileStatOrEmpty(paths.activeDbPath),
    backup: getFileStatOrEmpty(paths.backupPath),
    legacy: getFileStatOrEmpty(paths.legacyDbPath),
    legacyImport: getFileStatOrEmpty(paths.legacyImportPath),
    legacyAvailable: !!legacySourcePath,
    activeLikelyEmpty,
    legacySourcePath: legacySourcePath || "",
  };
}

function tableExists(dbConn, tableName) {
  const row = dbConn
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(tableName);
  return !!row;
}

function columnExists(dbConn, tableName, columnName) {
  const cols = dbConn.prepare(`PRAGMA table_info(${tableName})`).all();
  return cols.some((c) => c.name === columnName);
}

// ✅ Projekte: Stammdaten-Spalten nachziehen (alte DBs crashen sonst beim SELECT/UPDATE)
function ensureProjectsSchema(dbConn) {
  if (!tableExists(dbConn, "projects")) return;

  const addCol = (name, sqlType) => {
    if (!columnExists(dbConn, "projects", name)) {
      dbConn.exec(`ALTER TABLE projects ADD COLUMN ${name} ${sqlType};`);
    }
  };

  // ✅ Projektnummer
  addCol("project_number", "TEXT");

  addCol("short", "TEXT");
  addCol("street", "TEXT");
  addCol("zip", "TEXT");
  addCol("city", "TEXT");
  addCol("project_lead", "TEXT");
  addCol("project_lead_phone", "TEXT");
  addCol("start_date", "TEXT");
  addCol("end_date", "TEXT");
  addCol("notes", "TEXT");

  // ✅ Archiv-Flag (ISO Timestamp oder NULL)
  addCol("archived_at", "TEXT");
}

function ensureMeetingTopsSnapshotColumns(dbConn) {
  if (!tableExists(dbConn, "meeting_tops")) return;

  const addCol = (name, sqlType) => {
    if (!columnExists(dbConn, "meeting_tops", name)) {
      dbConn.exec(`ALTER TABLE meeting_tops ADD COLUMN ${name} ${sqlType};`);
    }
  };

  // Snapshot ("PDF-Stand") pro Meeting+TOP
  addCol("frozen_at", "TEXT"); // ISO Timestamp
  addCol("frozen_title", "TEXT");
  addCol("frozen_is_hidden", "INTEGER"); // 0/1
  addCol("frozen_parent_top_id", "TEXT");
  addCol("frozen_level", "INTEGER");
  addCol("frozen_number", "INTEGER");
  addCol("frozen_display_number", "TEXT");

  // Ampel-Snapshot (zum Schließzeitpunkt)
  addCol("frozen_ampel_color", "TEXT"); // 'gruen'|'orange'|'rot'|'blau'|null
  addCol("frozen_ampel_reason", "TEXT");
}

// ✅ Wichtig pro Meeting+TOP (meeting_tops)
function ensureMeetingTopsImportantColumn(dbConn) {
  if (!tableExists(dbConn, "meeting_tops")) return;

  if (!columnExists(dbConn, "meeting_tops", "is_important")) {
    // SQLite: NOT NULL nur ok, wenn DEFAULT gesetzt ist
    dbConn.exec(`ALTER TABLE meeting_tops ADD COLUMN is_important INTEGER NOT NULL DEFAULT 0;`);
  }
}

// ✅ "angefasst/geändert" pro Meeting+TOP (damit alte TOPs nach Edit blau werden können)
function ensureMeetingTopsTouchedColumn(dbConn) {
  if (!tableExists(dbConn, "meeting_tops")) return;

  if (!columnExists(dbConn, "meeting_tops", "is_touched")) {
    // SQLite: NOT NULL nur ok, wenn DEFAULT gesetzt ist
    dbConn.exec(`ALTER TABLE meeting_tops ADD COLUMN is_touched INTEGER NOT NULL DEFAULT 0;`);
  }
}

function ensureMeetingTopsCompletedColumn(dbConn) {
  if (!tableExists(dbConn, "meeting_tops")) return;

  if (!columnExists(dbConn, "meeting_tops", "completed_in_meeting_id")) {
    dbConn.exec(`ALTER TABLE meeting_tops ADD COLUMN completed_in_meeting_id TEXT;`);
  }
}

function ensureMeetingTopsResponsibleColumns(dbConn) {
  if (!tableExists(dbConn, "meeting_tops")) return;

  const addCol = (name, sqlType) => {
    if (!columnExists(dbConn, "meeting_tops", name)) {
      dbConn.exec(`ALTER TABLE meeting_tops ADD COLUMN ${name} ${sqlType};`);
    }
  };

  addCol("responsible_kind", "TEXT");
  addCol("responsible_id", "INTEGER");
  addCol("responsible_label", "TEXT");
}

function ensureMeetingTopsContactColumns(dbConn) {
  if (!tableExists(dbConn, "meeting_tops")) return;

  const addCol = (name, sqlType) => {
    if (!columnExists(dbConn, "meeting_tops", name)) {
      dbConn.exec(`ALTER TABLE meeting_tops ADD COLUMN ${name} ${sqlType};`);
    }
  };

  addCol("contact_kind", "TEXT");
  addCol("contact_person_id", "TEXT");
  addCol("contact_label", "TEXT");
}

function ensureMeetingTopsTaskFlagColumns(dbConn) {
  if (!tableExists(dbConn, "meeting_tops")) return;

  if (!columnExists(dbConn, "meeting_tops", "is_task")) {
    dbConn.exec(`ALTER TABLE meeting_tops ADD COLUMN is_task INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!columnExists(dbConn, "meeting_tops", "is_decision")) {
    dbConn.exec(`ALTER TABLE meeting_tops ADD COLUMN is_decision INTEGER NOT NULL DEFAULT 0;`);
  }
}

function ensureTopsSoftDeleteColumns(dbConn) {
  if (!tableExists(dbConn, "tops")) return;

  const addCol = (name, sqlType) => {
    if (!columnExists(dbConn, "tops", name)) {
      dbConn.exec(`ALTER TABLE tops ADD COLUMN ${name} ${sqlType};`);
    }
  };

  addCol("removed_at", "TEXT");
  addCol("is_trashed", "INTEGER NOT NULL DEFAULT 0");
  addCol("trashed_at", "INTEGER");
}

function ensureMeetingsTodoSnapshotColumn(dbConn) {
  if (!tableExists(dbConn, "meetings")) return;
  if (!columnExists(dbConn, "meetings", "todo_snapshot_json")) {
    dbConn.exec(`ALTER TABLE meetings ADD COLUMN todo_snapshot_json TEXT;`);
  }
}

function ensureMeetingsNextMeetingColumns(dbConn) {
  if (!tableExists(dbConn, "meetings")) return;
  const addCol = (name, sqlType) => {
    if (!columnExists(dbConn, "meetings", name)) {
      dbConn.exec(`ALTER TABLE meetings ADD COLUMN ${name} ${sqlType};`);
    }
  };
  addCol("next_meeting_enabled", "INTEGER");
  addCol("next_meeting_date", "TEXT");
  addCol("next_meeting_time", "TEXT");
  addCol("next_meeting_place", "TEXT");
  addCol("next_meeting_extra", "TEXT");
}

function ensureAudioImportsSchema(dbConn) {
  if (!tableExists(dbConn, "audio_imports")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS audio_imports (
        id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        original_file_name TEXT,
        mime_type TEXT,
        processing_mode TEXT NOT NULL DEFAULT 'review',
        status TEXT NOT NULL DEFAULT 'imported',
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
  } else {
    const addCol = (name, sqlType) => {
      if (!columnExists(dbConn, "audio_imports", name)) {
        dbConn.exec(`ALTER TABLE audio_imports ADD COLUMN ${name} ${sqlType};`);
      }
    };

    addCol("meeting_id", "TEXT");
    addCol("project_id", "TEXT");
    addCol("file_path", "TEXT");
    addCol("original_file_name", "TEXT");
    addCol("mime_type", "TEXT");
    addCol("processing_mode", "TEXT NOT NULL DEFAULT 'review'");
    addCol("status", "TEXT NOT NULL DEFAULT 'imported'");
    addCol("error_message", "TEXT");
    addCol(
      "created_at",
      "TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
    );
    addCol(
      "updated_at",
      "TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
    );
  }

  dbConn.exec(`
    CREATE INDEX IF NOT EXISTS idx_audio_imports_meeting_id
    ON audio_imports (meeting_id);
    CREATE INDEX IF NOT EXISTS idx_audio_imports_project_id
    ON audio_imports (project_id);
    CREATE INDEX IF NOT EXISTS idx_audio_imports_status
    ON audio_imports (status);
  `);
}

function ensureTranscriptsSchema(dbConn) {
  if (!tableExists(dbConn, "transcripts")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id TEXT PRIMARY KEY,
        audio_import_id TEXT NOT NULL UNIQUE,
        engine TEXT,
        language TEXT,
        full_text TEXT,
        segments_json TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        FOREIGN KEY (audio_import_id) REFERENCES audio_imports(id) ON DELETE CASCADE
      );
    `);
  } else {
    const addCol = (name, sqlType) => {
      if (!columnExists(dbConn, "transcripts", name)) {
        dbConn.exec(`ALTER TABLE transcripts ADD COLUMN ${name} ${sqlType};`);
      }
    };

    addCol("audio_import_id", "TEXT");
    addCol("engine", "TEXT");
    addCol("language", "TEXT");
    addCol("full_text", "TEXT");
    addCol("segments_json", "TEXT");
    addCol(
      "created_at",
      "TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
    );
    addCol(
      "updated_at",
      "TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
    );
  }

  dbConn.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transcripts_audio_import_id
    ON transcripts (audio_import_id);
  `);
}

function ensureAudioSuggestionsSchema(dbConn) {
  if (!tableExists(dbConn, "audio_suggestions")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS audio_suggestions (
        id TEXT PRIMARY KEY,
        audio_import_id TEXT NOT NULL,
        meeting_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL,
        target_top_id TEXT,
        parent_top_id TEXT,
        title_suggestion TEXT,
        text_suggestion TEXT,
        source_excerpt TEXT,
        confidence REAL,
        status TEXT NOT NULL DEFAULT 'pending',
        mapping_reason TEXT,
        applied_at TEXT,
        rejected_at TEXT,
        applied_target_top_id TEXT,
        applied_parent_top_id TEXT,
        applied_with_override INTEGER NOT NULL DEFAULT 0,
        apply_error TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        FOREIGN KEY (audio_import_id) REFERENCES audio_imports(id) ON DELETE CASCADE,
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
  } else {
    const addCol = (name, sqlType) => {
      if (!columnExists(dbConn, "audio_suggestions", name)) {
        dbConn.exec(`ALTER TABLE audio_suggestions ADD COLUMN ${name} ${sqlType};`);
      }
    };

    addCol("audio_import_id", "TEXT");
    addCol("meeting_id", "TEXT");
    addCol("project_id", "TEXT");
    addCol("type", "TEXT");
    addCol("target_top_id", "TEXT");
    addCol("parent_top_id", "TEXT");
    addCol("title_suggestion", "TEXT");
    addCol("text_suggestion", "TEXT");
    addCol("source_excerpt", "TEXT");
    addCol("confidence", "REAL");
    addCol("status", "TEXT NOT NULL DEFAULT 'pending'");
    addCol("mapping_reason", "TEXT");
    addCol("applied_at", "TEXT");
    addCol("rejected_at", "TEXT");
    addCol("applied_target_top_id", "TEXT");
    addCol("applied_parent_top_id", "TEXT");
    addCol("applied_with_override", "INTEGER NOT NULL DEFAULT 0");
    addCol("apply_error", "TEXT");
    addCol(
      "created_at",
      "TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
    );
    addCol(
      "updated_at",
      "TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
    );
  }

  dbConn.exec(`
    CREATE INDEX IF NOT EXISTS idx_audio_suggestions_audio_import_id
    ON audio_suggestions (audio_import_id);
    CREATE INDEX IF NOT EXISTS idx_audio_suggestions_meeting_id
    ON audio_suggestions (meeting_id);
    CREATE INDEX IF NOT EXISTS idx_audio_suggestions_project_id
    ON audio_suggestions (project_id);
    CREATE INDEX IF NOT EXISTS idx_audio_suggestions_status
    ON audio_suggestions (status);
  `);
}

function ensureAudioTermCorrectionsSchema(dbConn) {
  if (!tableExists(dbConn, "audio_term_corrections")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS audio_term_corrections (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        wrong_term TEXT NOT NULL,
        correct_term TEXT NOT NULL,
        usage_count INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
  } else {
    const addCol = (name, sqlType) => {
      if (!columnExists(dbConn, "audio_term_corrections", name)) {
        dbConn.exec(`ALTER TABLE audio_term_corrections ADD COLUMN ${name} ${sqlType};`);
      }
    };

    addCol("project_id", "TEXT");
    addCol("wrong_term", "TEXT");
    addCol("correct_term", "TEXT");
    addCol("usage_count", "INTEGER NOT NULL DEFAULT 0");
    addCol("is_active", "INTEGER NOT NULL DEFAULT 1");
    addCol(
      "created_at",
      "TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
    );
    addCol(
      "updated_at",
      "TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
    );
  }

  dbConn.exec(`
    CREATE INDEX IF NOT EXISTS idx_audio_term_corrections_project_id
    ON audio_term_corrections (project_id);
    CREATE INDEX IF NOT EXISTS idx_audio_term_corrections_wrong_term
    ON audio_term_corrections (wrong_term);
  `);
}

function ensureFirmsAndPersonsSchema(dbConn) {
  // ------------------------------------------------------------
  // firms (GLOBAL)
  // ------------------------------------------------------------
  if (!tableExists(dbConn, "firms")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS firms (
        id TEXT PRIMARY KEY,

        short TEXT,
        name TEXT NOT NULL,
        name2 TEXT,
        street TEXT,
        zip TEXT,
        city TEXT,
        phone TEXT,
        email TEXT,
        gewerk TEXT,
        notes TEXT,

        role_code INTEGER DEFAULT 60,

        is_trashed INTEGER NOT NULL DEFAULT 0,
        trashed_at INTEGER,
        removed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
    `);
  } else {
    const addFirmCol = (name, sqlType) => {
      if (!columnExists(dbConn, "firms", name)) {
        dbConn.exec(`ALTER TABLE firms ADD COLUMN ${name} ${sqlType};`);
      }
    };

    addFirmCol("short", "TEXT");
    addFirmCol("name", "TEXT"); // fail-safe
    addFirmCol("name2", "TEXT");
    addFirmCol("street", "TEXT");
    addFirmCol("zip", "TEXT");
    addFirmCol("city", "TEXT");
    addFirmCol("phone", "TEXT");
    addFirmCol("email", "TEXT");
    addFirmCol("gewerk", "TEXT");
    addFirmCol("notes", "TEXT");
    addFirmCol("role_code", "INTEGER DEFAULT 60");
    addFirmCol("is_trashed", "INTEGER NOT NULL DEFAULT 0");
    addFirmCol("trashed_at", "INTEGER");
    addFirmCol("removed_at", "TEXT");

    if (!columnExists(dbConn, "firms", "created_at")) {
      dbConn.exec(`
        ALTER TABLE firms
        ADD COLUMN created_at TEXT NOT NULL
        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      `);
    }
    if (!columnExists(dbConn, "firms", "updated_at")) {
      dbConn.exec(`
        ALTER TABLE firms
        ADD COLUMN updated_at TEXT NOT NULL
        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      `);
    }
  }

  // ------------------------------------------------------------
  // persons (GLOBAL, je Firma)
  // WICHTIG: persons.name wird von Repo/Service aus first/last gebildet.
  // ------------------------------------------------------------
  if (!tableExists(dbConn, "persons")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS persons (
        id TEXT PRIMARY KEY,
        firm_id TEXT NOT NULL,

        name TEXT NOT NULL,

        first_name TEXT,
        last_name TEXT,

        funktion TEXT,
        rolle TEXT,
        notes TEXT,

        email TEXT,
        phone TEXT,

        is_trashed INTEGER NOT NULL DEFAULT 0,
        trashed_at INTEGER,
        removed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

        FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE RESTRICT
      );
    `);
  } else {
    const addPersonCol = (name, sqlType) => {
      if (!columnExists(dbConn, "persons", name)) {
        dbConn.exec(`ALTER TABLE persons ADD COLUMN ${name} ${sqlType};`);
      }
    };

    addPersonCol("firm_id", "TEXT");
    addPersonCol("name", "TEXT"); // NOT NULL kann per ALTER nicht nachgezogen werden
    addPersonCol("first_name", "TEXT");
    addPersonCol("last_name", "TEXT");
    addPersonCol("funktion", "TEXT");
    addPersonCol("rolle", "TEXT");
    addPersonCol("notes", "TEXT");
    addPersonCol("email", "TEXT");
    addPersonCol("phone", "TEXT");
    addPersonCol("is_trashed", "INTEGER NOT NULL DEFAULT 0");
    addPersonCol("trashed_at", "INTEGER");
    addPersonCol("removed_at", "TEXT");

    if (!columnExists(dbConn, "persons", "created_at")) {
      dbConn.exec(`
        ALTER TABLE persons
        ADD COLUMN created_at TEXT NOT NULL
        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      `);
    }
    if (!columnExists(dbConn, "persons", "updated_at")) {
      dbConn.exec(`
        ALTER TABLE persons
        ADD COLUMN updated_at TEXT NOT NULL
        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      `);
    }
  }
}

function ensureProjectGlobalFirmsSchema(dbConn) {
  // ------------------------------------------------------------
  // project_global_firms (ZUORDNUNG: Projekt ↔ Global-Firma, Soft-Delete)
  // ------------------------------------------------------------
  if (!tableExists(dbConn, "project_global_firms")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS project_global_firms (
        project_id TEXT NOT NULL,
        firm_id TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,

        removed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

        PRIMARY KEY (project_id, firm_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE RESTRICT
      );
    `);
  } else {
    const addCol = (name, sqlType) => {
      if (!columnExists(dbConn, "project_global_firms", name)) {
        dbConn.exec(`ALTER TABLE project_global_firms ADD COLUMN ${name} ${sqlType};`);
      }
    };

    addCol("project_id", "TEXT");
    addCol("firm_id", "TEXT");
    if (!columnExists(dbConn, "project_global_firms", "is_active")) {
      dbConn.exec(`ALTER TABLE project_global_firms ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;`);
    }
    addCol("removed_at", "TEXT");

    if (!columnExists(dbConn, "project_global_firms", "created_at")) {
      dbConn.exec(`
        ALTER TABLE project_global_firms
        ADD COLUMN created_at TEXT NOT NULL
        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      `);
    }
    if (!columnExists(dbConn, "project_global_firms", "updated_at")) {
      dbConn.exec(`
        ALTER TABLE project_global_firms
        ADD COLUMN updated_at TEXT NOT NULL
        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      `);
    }
  }
}

function ensureProjectFirmsAndPersonsSchema(dbConn) {
  // ------------------------------------------------------------
  // project_firms (PROJEKT-LOKAL)
  // ------------------------------------------------------------
  if (!tableExists(dbConn, "project_firms")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS project_firms (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,

        short TEXT,
        name TEXT NOT NULL,
        name2 TEXT,
        street TEXT,
        zip TEXT,
        city TEXT,
        phone TEXT,
        email TEXT,
        gewerk TEXT,
        notes TEXT,

        role_code INTEGER DEFAULT 60,

        removed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
  } else {
    const addCol = (name, sqlType) => {
      if (!columnExists(dbConn, "project_firms", name)) {
        dbConn.exec(`ALTER TABLE project_firms ADD COLUMN ${name} ${sqlType};`);
      }
    };

    addCol("project_id", "TEXT");
    if (!columnExists(dbConn, "project_firms", "is_active")) {
      dbConn.exec(`ALTER TABLE project_firms ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;`);
    }
    addCol("short", "TEXT");
    addCol("name", "TEXT"); // fail-safe
    addCol("name2", "TEXT");
    addCol("street", "TEXT");
    addCol("zip", "TEXT");
    addCol("city", "TEXT");
    addCol("phone", "TEXT");
    addCol("email", "TEXT");
    addCol("gewerk", "TEXT");
    addCol("notes", "TEXT");
    addCol("role_code", "INTEGER DEFAULT 60");
    addCol("removed_at", "TEXT");

    if (!columnExists(dbConn, "project_firms", "created_at")) {
      dbConn.exec(`
        ALTER TABLE project_firms
        ADD COLUMN created_at TEXT NOT NULL
        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      `);
    }
    if (!columnExists(dbConn, "project_firms", "updated_at")) {
      dbConn.exec(`
        ALTER TABLE project_firms
        ADD COLUMN updated_at TEXT NOT NULL
        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      `);
    }
  }

  // ------------------------------------------------------------
  // project_persons (PROJEKT-LOKAL, je Projektfirma)
  // FK muss auf project_firms(id) zeigen -> sonst "foreign key mismatch".
  // ------------------------------------------------------------
  if (!tableExists(dbConn, "project_persons")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS project_persons (
        id TEXT PRIMARY KEY,
        project_firm_id TEXT NOT NULL,

        name TEXT NOT NULL,

        first_name TEXT,
        last_name TEXT,

        funktion TEXT,
        rolle TEXT,
        notes TEXT,

        email TEXT,
        phone TEXT,

        removed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

        FOREIGN KEY (project_firm_id) REFERENCES project_firms(id) ON DELETE RESTRICT
      );
    `);
  } else {
    const addCol = (name, sqlType) => {
      if (!columnExists(dbConn, "project_persons", name)) {
        dbConn.exec(`ALTER TABLE project_persons ADD COLUMN ${name} ${sqlType};`);
      }
    };

    addCol("project_firm_id", "TEXT");
    addCol("name", "TEXT");
    addCol("first_name", "TEXT");
    addCol("last_name", "TEXT");
    addCol("funktion", "TEXT");
    addCol("rolle", "TEXT");
    addCol("notes", "TEXT");
    addCol("email", "TEXT");
    addCol("phone", "TEXT");
    addCol("removed_at", "TEXT");

    if (!columnExists(dbConn, "project_persons", "created_at")) {
      dbConn.exec(`
        ALTER TABLE project_persons
        ADD COLUMN created_at TEXT NOT NULL
        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      `);
    }
    if (!columnExists(dbConn, "project_persons", "updated_at")) {
      dbConn.exec(`
        ALTER TABLE project_persons
        ADD COLUMN updated_at TEXT NOT NULL
        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      `);
    }
  }
}

// ✅ NEU: Kandidaten-Whitelist je Projekt

function ensureProjectSettingsSchema(dbConn) {
  if (!tableExists(dbConn, "project_settings")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS project_settings (
        project_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        PRIMARY KEY (project_id, key),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
    return;
  }

  const addCol = (name, sqlType) => {
    if (!columnExists(dbConn, "project_settings", name)) {
      dbConn.exec(`ALTER TABLE project_settings ADD COLUMN ${name} ${sqlType};`);
    }
  };

  addCol("project_id", "TEXT");
  addCol("key", "TEXT");
  addCol("value", "TEXT");

  if (!columnExists(dbConn, "project_settings", "created_at")) {
    dbConn.exec(`
      ALTER TABLE project_settings
      ADD COLUMN created_at TEXT NOT NULL
      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    `);
  }
  if (!columnExists(dbConn, "project_settings", "updated_at")) {
    dbConn.exec(`
      ALTER TABLE project_settings
      ADD COLUMN updated_at TEXT NOT NULL
      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    `);
  }
}

function ensureProjectCandidatesSchema(dbConn) {
  if (!tableExists(dbConn, "project_candidates")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS project_candidates (
        project_id TEXT NOT NULL,
        kind TEXT NOT NULL, -- "project_person" | "global_person"
        person_id TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,

        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

        PRIMARY KEY (project_id, kind, person_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
    return;
  }

  const addCol = (name, sqlType) => {
    if (!columnExists(dbConn, "project_candidates", name)) {
      dbConn.exec(`ALTER TABLE project_candidates ADD COLUMN ${name} ${sqlType};`);
    }
  };

  addCol("project_id", "TEXT");
  addCol("kind", "TEXT");
  addCol("person_id", "TEXT");
  if (!columnExists(dbConn, "project_candidates", "is_active")) {
    dbConn.exec(`ALTER TABLE project_candidates ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;`);
  }

  if (!columnExists(dbConn, "project_candidates", "created_at")) {
    dbConn.exec(`
      ALTER TABLE project_candidates
      ADD COLUMN created_at TEXT NOT NULL
      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    `);
  }
  if (!columnExists(dbConn, "project_candidates", "updated_at")) {
    dbConn.exec(`
      ALTER TABLE project_candidates
      ADD COLUMN updated_at TEXT NOT NULL
      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    `);
  }
}

function ensureSingleOpenMeetingPerProject(dbConn) {
  if (!tableExists(dbConn, "meetings")) return;

  const duplicates = dbConn
    .prepare(
      `
      SELECT project_id
      FROM meetings
      WHERE COALESCE(is_closed, 0) = 0
      GROUP BY project_id
      HAVING COUNT(*) > 1
    `
    )
    .all();

  if ((duplicates || []).length) {
    const pickOpen = dbConn.prepare(
      `
      SELECT id
      FROM meetings
      WHERE project_id = ?
        AND COALESCE(is_closed, 0) = 0
      ORDER BY meeting_index DESC, updated_at DESC, created_at DESC
      LIMIT 1
    `
    );
    const closeOthers = dbConn.prepare(
      `
      UPDATE meetings
      SET is_closed = 1, updated_at = ?
      WHERE project_id = ?
        AND COALESCE(is_closed, 0) = 0
        AND id <> ?
    `
    );
    const now = new Date().toISOString();
    const tx = dbConn.transaction(() => {
      for (const row of duplicates) {
        const keep = pickOpen.get(row.project_id);
        if (!keep?.id) continue;
        closeOthers.run(now, row.project_id, keep.id);
      }
    });
    tx();
  }

  dbConn.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_one_open_per_project
    ON meetings(project_id)
    WHERE is_closed = 0;
  `);
}

// ✅ NEU: Teilnehmer je Meeting inkl. Flags (anwesend / im Verteiler)
function ensureMeetingParticipantsSchema(dbConn) {
  if (!tableExists(dbConn, "meeting_participants")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS meeting_participants (
        meeting_id TEXT NOT NULL,
        kind TEXT NOT NULL, -- "project_person" | "global_person"
        person_id TEXT NOT NULL,

        is_present INTEGER NOT NULL DEFAULT 0,
        is_in_distribution INTEGER NOT NULL DEFAULT 0,

        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

        PRIMARY KEY (meeting_id, kind, person_id),
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      );
    `);
    return;
  }

  const addCol = (name, sqlType) => {
    if (!columnExists(dbConn, "meeting_participants", name)) {
      dbConn.exec(`ALTER TABLE meeting_participants ADD COLUMN ${name} ${sqlType};`);
    }
  };

  addCol("meeting_id", "TEXT");
  addCol("kind", "TEXT");
  addCol("person_id", "TEXT");

  if (!columnExists(dbConn, "meeting_participants", "is_present")) {
    dbConn.exec(
      `ALTER TABLE meeting_participants ADD COLUMN is_present INTEGER NOT NULL DEFAULT 0;`
    );
  }
  if (!columnExists(dbConn, "meeting_participants", "is_in_distribution")) {
    dbConn.exec(
      `ALTER TABLE meeting_participants ADD COLUMN is_in_distribution INTEGER NOT NULL DEFAULT 0;`
    );
  }

  if (!columnExists(dbConn, "meeting_participants", "created_at")) {
    dbConn.exec(`
      ALTER TABLE meeting_participants
      ADD COLUMN created_at TEXT NOT NULL
      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    `);
  }
  if (!columnExists(dbConn, "meeting_participants", "updated_at")) {
    dbConn.exec(`
      ALTER TABLE meeting_participants
      ADD COLUMN updated_at TEXT NOT NULL
      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    `);
  }
}

// ✅ App-Settings (Key/Value) – für Header rechts: user_name + user_company
function ensureAppSettingsSchema(dbConn) {
  if (!tableExists(dbConn, "app_settings")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
    `);
    return;
  }

  // falls alte DB ohne timestamps
  const addCol = (name, sqlType) => {
    if (!columnExists(dbConn, "app_settings", name)) {
      dbConn.exec(`ALTER TABLE app_settings ADD COLUMN ${name} ${sqlType};`);
    }
  };

  addCol("value", "TEXT");

  if (!columnExists(dbConn, "app_settings", "created_at")) {
    dbConn.exec(`
      ALTER TABLE app_settings
      ADD COLUMN created_at TEXT NOT NULL
      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    `);
  }
  if (!columnExists(dbConn, "app_settings", "updated_at")) {
    dbConn.exec(`
      ALTER TABLE app_settings
      ADD COLUMN updated_at TEXT NOT NULL
      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    `);
  }
}

function ensureDictionarySchema(dbConn) {
  if (!tableExists(dbConn, "dictionary_suggestions")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS dictionary_suggestions (
        norm_key TEXT PRIMARY KEY,
        term TEXT NOT NULL,
        variants_json TEXT,
        frequency INTEGER NOT NULL DEFAULT 0,
        source_path TEXT,
        source_excerpt TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
    `);
  }

  if (!tableExists(dbConn, "dictionary_terms")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS dictionary_terms (
        norm_key TEXT PRIMARY KEY,
        term TEXT NOT NULL,
        variants_json TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
    `);
  }

  dbConn.exec(`CREATE INDEX IF NOT EXISTS idx_dictionary_suggestions_status ON dictionary_suggestions(status);`);
  dbConn.exec(`CREATE INDEX IF NOT EXISTS idx_dictionary_terms_active ON dictionary_terms(is_active);`);
}

// ✅ Nutzerdaten (Name 1/2, Straße, PLZ, Ort)
function ensureUserProfileSchema(dbConn) {
  if (!tableExists(dbConn, "user_profile")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY,
        name1 TEXT,
        name2 TEXT,
        street TEXT,
        zip TEXT,
        city TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
    `);
    return;
  }

  const addCol = (name, sqlType) => {
    if (!columnExists(dbConn, "user_profile", name)) {
      dbConn.exec(`ALTER TABLE user_profile ADD COLUMN ${name} ${sqlType};`);
    }
  };

  addCol("name1", "TEXT");
  addCol("name2", "TEXT");
  addCol("street", "TEXT");
  addCol("zip", "TEXT");
  addCol("city", "TEXT");

  if (!columnExists(dbConn, "user_profile", "created_at")) {
    dbConn.exec(`
      ALTER TABLE user_profile
      ADD COLUMN created_at TEXT NOT NULL
      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    `);
  }
  if (!columnExists(dbConn, "user_profile", "updated_at")) {
    dbConn.exec(`
      ALTER TABLE user_profile
      ADD COLUMN updated_at TEXT NOT NULL
      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    `);
  }
}

/**
 * Migration:
 * - Falls altes tops-Schema (mit meeting_id in tops) existiert,
 *   wird auf neues Modell migriert:
 *   tops (global) + meeting_tops (Zustand je Besprechung).
 */
function migrateLegacyTopsToMeetingTops(dbConn) {
  if (!tableExists(dbConn, "tops")) return;
  if (!columnExists(dbConn, "tops", "meeting_id")) return;
  if (tableExists(dbConn, "meeting_tops")) return;

  dbConn.exec(`PRAGMA foreign_keys = OFF;`);

  dbConn.exec(`
    CREATE TABLE IF NOT EXISTS tops_new (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parent_top_id TEXT,
      level INTEGER NOT NULL,
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      is_trashed INTEGER NOT NULL DEFAULT 0,
      trashed_at INTEGER,
      removed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_top_id) REFERENCES tops_new(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meeting_tops (
      meeting_id TEXT NOT NULL,
      top_id TEXT NOT NULL,

      status TEXT DEFAULT 'offen',
      due_date TEXT,
      longtext TEXT,

      is_carried_over INTEGER NOT NULL DEFAULT 0,
      is_important INTEGER NOT NULL DEFAULT 0,
      is_touched INTEGER NOT NULL DEFAULT 0,
      completed_in_meeting_id TEXT,

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      -- Snapshot-Spalten (PDF-Stand)
      frozen_at TEXT,
      frozen_title TEXT,
      frozen_is_hidden INTEGER,
      frozen_parent_top_id TEXT,
      frozen_level INTEGER,
      frozen_number INTEGER,
      frozen_display_number TEXT,
      frozen_ampel_color TEXT,
      frozen_ampel_reason TEXT,

      PRIMARY KEY (meeting_id, top_id),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
      FOREIGN KEY (top_id) REFERENCES tops_new(id) ON DELETE CASCADE
    );
  `);

  const now = new Date().toISOString();

  dbConn.exec(`
    INSERT INTO tops_new (
      id, project_id, parent_top_id, level, number, title, is_hidden, is_trashed, trashed_at, removed_at, created_at, updated_at
    )
    SELECT
      id,
      project_id,
      parent_top_id,
      level,
      number,
      title,
      0 AS is_hidden,
      0 AS is_trashed,
      NULL AS trashed_at,
      NULL AS removed_at,
      COALESCE(created_at, '${now}') AS created_at,
      COALESCE(updated_at, COALESCE(created_at, '${now}')) AS updated_at
    FROM tops;
  `);

  dbConn.exec(`
    INSERT INTO meeting_tops (
      meeting_id, top_id, status, due_date, longtext, is_carried_over, is_important, is_touched, created_at, updated_at
    )
    SELECT
      meeting_id,
      id AS top_id,
      COALESCE(status, 'offen') AS status,
      due_date,
      NULL AS longtext,
      0 AS is_carried_over,
      0 AS is_important,
      0 AS is_touched,
      COALESCE(created_at, '${now}') AS created_at,
      COALESCE(updated_at, COALESCE(created_at, '${now}')) AS updated_at
    FROM tops;
  `);

  dbConn.exec(`
    DROP TABLE tops;
    ALTER TABLE tops_new RENAME TO tops;
  `);

  dbConn.exec(`PRAGMA foreign_keys = ON;`);

  // Danach Snapshot/Soft-Delete/Wichtig/Touch-Spalten sicherstellen
  ensureMeetingTopsSnapshotColumns(dbConn);
  ensureMeetingTopsImportantColumn(dbConn);
  ensureMeetingTopsTouchedColumn(dbConn);
  ensureMeetingTopsCompletedColumn(dbConn);
  ensureMeetingTopsResponsibleColumns(dbConn);
  ensureMeetingTopsContactColumns(dbConn);
  ensureMeetingTopsTaskFlagColumns(dbConn);
  ensureTopsSoftDeleteColumns(dbConn);
}

function ensureSchema(dbConn) {
  // ✅ Projekte zuerst
  ensureProjectsSchema(dbConn);
  ensureUserProfileSchema(dbConn);

  // meetings: is_closed + created_at + updated_at müssen existieren
  if (!columnExists(dbConn, "meetings", "is_closed")) {
    dbConn.exec(`ALTER TABLE meetings ADD COLUMN is_closed INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!columnExists(dbConn, "meetings", "created_at")) {
    dbConn.exec(`
      ALTER TABLE meetings
      ADD COLUMN created_at TEXT NOT NULL
      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    `);
  }
  if (!columnExists(dbConn, "meetings", "updated_at")) {
    dbConn.exec(`
      ALTER TABLE meetings
      ADD COLUMN updated_at TEXT NOT NULL
      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    `);
  }

  if (!columnExists(dbConn, "meetings", "pdf_show_ampel")) {
    dbConn.exec(`ALTER TABLE meetings ADD COLUMN pdf_show_ampel INTEGER;`);
  }
  ensureMeetingsTodoSnapshotColumn(dbConn);
  ensureMeetingsNextMeetingColumns(dbConn);
  ensureSingleOpenMeetingPerProject(dbConn);

  migrateLegacyTopsToMeetingTops(dbConn);

  if (!tableExists(dbConn, "tops")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS tops (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        parent_top_id TEXT,
        level INTEGER NOT NULL,
        number INTEGER NOT NULL,
        title TEXT NOT NULL,
        is_hidden INTEGER NOT NULL DEFAULT 0,
        is_trashed INTEGER NOT NULL DEFAULT 0,
        trashed_at INTEGER,
        removed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_top_id) REFERENCES tops(id) ON DELETE CASCADE
      );
    `);
  }

  if (!tableExists(dbConn, "meeting_tops")) {
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS meeting_tops (
        meeting_id TEXT NOT NULL,
        top_id TEXT NOT NULL,

        status TEXT DEFAULT 'offen',
        due_date TEXT,
        longtext TEXT,

        is_carried_over INTEGER NOT NULL DEFAULT 0,
        is_important INTEGER NOT NULL DEFAULT 0,
        is_touched INTEGER NOT NULL DEFAULT 0,
        completed_in_meeting_id TEXT,

        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

        frozen_at TEXT,
        frozen_title TEXT,
        frozen_is_hidden INTEGER,
        frozen_parent_top_id TEXT,
        frozen_level INTEGER,
        frozen_number INTEGER,
        frozen_display_number TEXT,
        frozen_ampel_color TEXT,
        frozen_ampel_reason TEXT,

        PRIMARY KEY (meeting_id, top_id),
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
        FOREIGN KEY (top_id) REFERENCES tops(id) ON DELETE CASCADE
      );
    `);
  }

  ensureMeetingTopsSnapshotColumns(dbConn);
  ensureMeetingTopsImportantColumn(dbConn);
  ensureMeetingTopsTouchedColumn(dbConn);
  ensureMeetingTopsCompletedColumn(dbConn);
  ensureMeetingTopsResponsibleColumns(dbConn);
  ensureMeetingTopsContactColumns(dbConn);
  ensureMeetingTopsTaskFlagColumns(dbConn);
  ensureTopsSoftDeleteColumns(dbConn);
  ensureFirmsAndPersonsSchema(dbConn);
  ensureProjectGlobalFirmsSchema(dbConn);
  ensureProjectFirmsAndPersonsSchema(dbConn);

  ensureProjectSettingsSchema(dbConn);
  ensureProjectCandidatesSchema(dbConn);
  ensureMeetingParticipantsSchema(dbConn);
  ensureAudioImportsSchema(dbConn);
  ensureTranscriptsSchema(dbConn);
  ensureAudioSuggestionsSchema(dbConn);
  ensureAudioTermCorrectionsSchema(dbConn);

  ensureDictionarySchema(dbConn);
  ensureAppSettingsSchema(dbConn);
}

function initDatabase() {
  if (db) return db;

  const paths = getDbPaths();
  fs.mkdirSync(paths.userDataPath, { recursive: true });
  ensureLegacyImportCopy(paths);

  console.log("[db] using", paths.activeDbPath);
  console.log("[db] backup", paths.backupPath);

  if (fs.existsSync(paths.activeDbPath)) {
    fs.copyFileSync(paths.activeDbPath, paths.backupPath);
    console.log("[db] backup created", paths.backupPath);
  }

  console.log("[db] legacy", paths.legacyDbPath);
  console.log("[db] legacy-import", paths.legacyImportPath);

  db = new Database(paths.activeDbPath);

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,

      project_number TEXT,

      name TEXT NOT NULL,

      short TEXT,
      street TEXT,
      zip TEXT,
      city TEXT,
      project_lead TEXT,
      project_lead_phone TEXT,
      start_date TEXT,
      end_date TEXT,
      notes TEXT,

      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      meeting_index INTEGER NOT NULL,
      title TEXT,
      is_closed INTEGER NOT NULL DEFAULT 0,
      pdf_show_ampel INTEGER,
      todo_snapshot_json TEXT,
      next_meeting_enabled INTEGER,
      next_meeting_date TEXT,
      next_meeting_time TEXT,
      next_meeting_place TEXT,
      next_meeting_extra TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  ensureSchema(db);

  return db;
}

module.exports = {
  initDatabase,
  closeDatabase,
  getDbPaths,
  getDatabaseDiagnostics,
  isDbLikelyEmpty,
  importLegacyIntoActive,
};
