import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/lib/db/schema";

const SCHEMA_VERSION = "monitoring-v1";

type SqliteDatabase = Database.Database;
type DrizzleDatabase = ReturnType<typeof drizzle<typeof schema>>;

let sqlite: SqliteDatabase | null = null;
let db: DrizzleDatabase | null = null;
let initialized = false;

export function getDashboardDir() {
  return path.resolve(process.cwd(), ".dashboard");
}

export function getDatabasePath() {
  return (
    process.env.DASHBOARD_DB_PATH ??
    path.join(getDashboardDir(), "dashboard.sqlite")
  );
}

export function getSqlite() {
  if (!sqlite) {
    fs.mkdirSync(path.dirname(getDatabasePath()), { recursive: true });
    sqlite = new Database(getDatabasePath());
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
  }

  return sqlite;
}

export function getDb() {
  if (!db) {
    db = drizzle(getSqlite(), { schema });
  }

  return db;
}

function getExistingSchemaVersion() {
  const settingsTable = getSqlite()
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'"
    )
    .get();

  if (!settingsTable) return null;

  try {
    const row = getSqlite()
      .prepare("SELECT value FROM settings WHERE key = 'schema_version'")
      .get() as { value?: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

function resetLegacySchemaIfNeeded() {
  const version = getExistingSchemaVersion();
  if (version === SCHEMA_VERSION) return;

  getSqlite().exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS decisions;
    DROP TABLE IF EXISTS codex_sessions;
    DROP TABLE IF EXISTS events;
    DROP TABLE IF EXISTS runs;
    DROP TABLE IF EXISTS activity_entries;
    DROP TABLE IF EXISTS agent_checkpoints;
    DROP TABLE IF EXISTS cards;
    DROP TABLE IF EXISTS milestones;
    DROP TABLE IF EXISTS goals;
    DROP TABLE IF EXISTS design_tokens;
    DROP TABLE IF EXISTS harness_profiles;
    DROP TABLE IF EXISTS subagents;
    DROP TABLE IF EXISTS settings;
    PRAGMA foreign_keys = ON;
  `);
}

export function initializeDatabase() {
  if (initialized) return;

  resetLegacySchemaIfNeeded();

  getSqlite().exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      priority TEXT NOT NULL DEFAULT 'medium',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES goals(id),
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      milestone_id TEXT NOT NULL REFERENCES milestones(id),
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'medium',
      owner TEXT NOT NULL DEFAULT 'agent',
      size TEXT NOT NULL DEFAULT 'M',
      acceptance_criteria TEXT NOT NULL DEFAULT '',
      verification_command TEXT NOT NULL DEFAULT '',
      depends_on_json TEXT NOT NULL DEFAULT '[]',
      position INTEGER NOT NULL DEFAULT 0,
      github_issue_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_entries (
      id TEXT PRIMARY KEY,
      phase TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'codex',
      status TEXT NOT NULL DEFAULT 'done',
      task TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_checkpoints (
      id TEXT PRIMARY KEY,
      agent TEXT NOT NULL DEFAULT 'codex',
      task TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      summary TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS design_tokens (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      category TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'global',
      status TEXT NOT NULL DEFAULT 'draft',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS harness_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      skills_json TEXT NOT NULL DEFAULT '[]',
      mcp_json TEXT NOT NULL DEFAULT '{}',
      instructions TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subagents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'gpt-5-codex',
      reasoning_effort TEXT NOT NULL DEFAULT 'medium',
      sandbox TEXT NOT NULL DEFAULT 'read-only',
      tools_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft',
      file_path TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS milestones_goal_idx ON milestones(goal_id);
    CREATE INDEX IF NOT EXISTS cards_milestone_idx ON cards(milestone_id);
    CREATE INDEX IF NOT EXISTS cards_status_idx ON cards(status);
    CREATE INDEX IF NOT EXISTS cards_priority_idx ON cards(priority);
    CREATE INDEX IF NOT EXISTS activity_created_idx ON activity_entries(created_at);
    CREATE INDEX IF NOT EXISTS activity_phase_idx ON activity_entries(phase);
    CREATE INDEX IF NOT EXISTS checkpoints_agent_idx ON agent_checkpoints(agent);
    CREATE INDEX IF NOT EXISTS checkpoints_created_idx ON agent_checkpoints(created_at);
  `);

  getSqlite()
    .prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ('schema_version', @version, @updatedAt)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run({ version: SCHEMA_VERSION, updatedAt: new Date().toISOString() });

  initialized = true;
}
