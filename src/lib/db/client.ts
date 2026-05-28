import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/lib/db/schema";

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

export function initializeDatabase() {
  if (initialized) return;

  getSqlite().exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES goals(id),
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
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
      position INTEGER NOT NULL DEFAULT 0,
      github_issue_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      card_id TEXT REFERENCES cards(id),
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'standard',
      status TEXT NOT NULL DEFAULT 'queued',
      risk_level TEXT NOT NULL DEFAULT 'normal',
      approval_policy TEXT NOT NULL DEFAULT 'risk_gated',
      result TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      run_id TEXT REFERENCES runs(id),
      type TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'dashboard',
      severity TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      run_id TEXT REFERENCES runs(id),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      options_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
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

    CREATE TABLE IF NOT EXISTS codex_sessions (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'offline',
      last_seen_at TEXT,
      current_run_id TEXT REFERENCES runs(id),
      heartbeat_interval_seconds INTEGER NOT NULL DEFAULT 30,
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS milestones_goal_idx ON milestones(goal_id);
    CREATE INDEX IF NOT EXISTS cards_milestone_idx ON cards(milestone_id);
    CREATE INDEX IF NOT EXISTS cards_status_idx ON cards(status);
    CREATE INDEX IF NOT EXISTS runs_card_idx ON runs(card_id);
    CREATE INDEX IF NOT EXISTS runs_status_idx ON runs(status);
    CREATE INDEX IF NOT EXISTS events_run_idx ON events(run_id);
    CREATE INDEX IF NOT EXISTS events_created_idx ON events(created_at);
    CREATE INDEX IF NOT EXISTS decisions_status_idx ON decisions(status);
  `);

  initialized = true;
}

