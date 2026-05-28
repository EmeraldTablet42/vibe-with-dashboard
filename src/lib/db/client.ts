import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/lib/db/schema";
import { getProjectRoot } from "@/lib/project-root";

const SCHEMA_VERSION = "vibe-dashboard-v3";

type SqliteDatabase = Database.Database;
type DrizzleDatabase = ReturnType<typeof drizzle<typeof schema>>;

let sqlite: SqliteDatabase | null = null;
let db: DrizzleDatabase | null = null;
let initialized = false;

export function getDashboardDir() {
  return path.join(getProjectRoot(), ".dashboard");
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
  if (
    version === SCHEMA_VERSION ||
    version === "vibe-dashboard-v2" ||
    version === "vibe-dashboard-v1"
  ) {
    return;
  }

  const tableRows = getSqlite()
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    )
    .all() as Array<{ name: string }>;

  getSqlite().exec("PRAGMA foreign_keys = OFF;");
  for (const row of tableRows) {
    if (!/^[A-Za-z0-9_]+$/.test(row.name)) continue;
    getSqlite().exec(`DROP TABLE IF EXISTS "${row.name}";`);
  }
  getSqlite().exec("PRAGMA foreign_keys = ON;");
}

function ensureColumn(table: string, column: string, definition: string) {
  const rows = getSqlite().prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  if (rows.some((row) => row.name === column)) return;
  getSqlite().exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

export function initializeDatabase() {
  if (initialized) return;

  resetLegacySchemaIfNeeded();

  getSqlite().exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      task TEXT NOT NULL DEFAULT '',
      translations_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS board_archives (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      title TEXT NOT NULL,
      task TEXT NOT NULL DEFAULT '',
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id),
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      translations_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      priority TEXT NOT NULL DEFAULT 'medium',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id),
      goal_id TEXT NOT NULL REFERENCES goals(id),
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      translations_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'planned',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id),
      milestone_id TEXT NOT NULL REFERENCES milestones(id),
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      translations_json TEXT NOT NULL DEFAULT '{}',
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
      board_id TEXT NOT NULL REFERENCES boards(id),
      phase TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'agent',
      status TEXT NOT NULL DEFAULT 'done',
      task TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      translations_json TEXT NOT NULL DEFAULT '{}',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS duck_suggestions (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id),
      keyword TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT '',
      action_prompt TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium',
      source TEXT NOT NULL DEFAULT 'agent',
      translations_json TEXT NOT NULL DEFAULT '{}',
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_checkpoints (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id),
      agent TEXT NOT NULL DEFAULT 'agent',
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
      model TEXT NOT NULL DEFAULT 'agent-default',
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

    CREATE INDEX IF NOT EXISTS boards_status_idx ON boards(status);
    CREATE INDEX IF NOT EXISTS board_archives_created_idx ON board_archives(created_at);
    CREATE INDEX IF NOT EXISTS goals_board_idx ON goals(board_id);
    CREATE INDEX IF NOT EXISTS milestones_board_idx ON milestones(board_id);
    CREATE INDEX IF NOT EXISTS milestones_goal_idx ON milestones(goal_id);
    CREATE INDEX IF NOT EXISTS cards_board_idx ON cards(board_id);
    CREATE INDEX IF NOT EXISTS cards_milestone_idx ON cards(milestone_id);
    CREATE INDEX IF NOT EXISTS cards_status_idx ON cards(status);
    CREATE INDEX IF NOT EXISTS cards_priority_idx ON cards(priority);
    CREATE INDEX IF NOT EXISTS activity_board_idx ON activity_entries(board_id);
    CREATE INDEX IF NOT EXISTS activity_created_idx ON activity_entries(created_at);
    CREATE INDEX IF NOT EXISTS activity_phase_idx ON activity_entries(phase);
    CREATE INDEX IF NOT EXISTS duck_suggestions_board_idx ON duck_suggestions(board_id);
    CREATE INDEX IF NOT EXISTS duck_suggestions_read_idx ON duck_suggestions(read_at);
    CREATE INDEX IF NOT EXISTS duck_suggestions_priority_idx ON duck_suggestions(priority);
    CREATE INDEX IF NOT EXISTS checkpoints_board_idx ON agent_checkpoints(board_id);
    CREATE INDEX IF NOT EXISTS checkpoints_agent_idx ON agent_checkpoints(agent);
    CREATE INDEX IF NOT EXISTS checkpoints_created_idx ON agent_checkpoints(created_at);
  `);

  ensureColumn("boards", "translations_json", "translations_json TEXT NOT NULL DEFAULT '{}'");
  ensureColumn("goals", "translations_json", "translations_json TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(
    "milestones",
    "translations_json",
    "translations_json TEXT NOT NULL DEFAULT '{}'"
  );
  ensureColumn("cards", "translations_json", "translations_json TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(
    "activity_entries",
    "translations_json",
    "translations_json TEXT NOT NULL DEFAULT '{}'"
  );

  getSqlite()
    .prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ('schema_version', @version, @updatedAt)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run({ version: SCHEMA_VERSION, updatedAt: new Date().toISOString() });

  initialized = true;
}
