-- src/main/db/schema.sql

-- Hinweis: database.js ist "Source of truth" für Migrationen.
-- Diese Datei ist als Referenz/Lesbarkeit gedacht.

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  meeting_index INTEGER NOT NULL,
  title TEXT,
  is_closed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tops (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_top_id TEXT,
  level INTEGER NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_top_id) REFERENCES tops(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meeting_tops (
  meeting_id TEXT NOT NULL,
  top_id TEXT NOT NULL,

  status TEXT DEFAULT 'offen',
  due_date TEXT,
  longtext TEXT,
  contact_kind TEXT,
  contact_person_id TEXT,
  contact_label TEXT,

  is_carried_over INTEGER NOT NULL DEFAULT 0,
  is_task INTEGER NOT NULL DEFAULT 0,
  is_decision INTEGER NOT NULL DEFAULT 0,
  completed_in_meeting_id TEXT,

  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

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
  FOREIGN KEY (top_id) REFERENCES tops(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS dictionary_terms (
  norm_key TEXT PRIMARY KEY,
  term TEXT NOT NULL,
  variants_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
