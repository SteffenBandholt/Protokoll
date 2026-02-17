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

  is_carried_over INTEGER NOT NULL DEFAULT 0,
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
