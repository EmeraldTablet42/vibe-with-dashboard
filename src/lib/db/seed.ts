import { asc, desc } from "drizzle-orm";

import { getDb, getSqlite, initializeDatabase } from "@/lib/db/client";
import {
  activityEntries,
  agentCheckpoints,
  boardArchives,
  boards,
  cards,
  designTokens,
  goals,
  harnessProfiles,
  milestones,
  settings,
  subagents,
} from "@/lib/db/schema";

const now = () => new Date().toISOString();
export const EMPTY_BOARD_ID = "board-active";

function countTable(table: string) {
  return (
    getSqlite().prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
      count: number;
    }
  ).count;
}

function ensureActiveBoard() {
  const active = getSqlite()
    .prepare("SELECT id FROM boards WHERE status = 'active' LIMIT 1")
    .get() as { id: string } | undefined;

  if (active) return active.id;

  getDb()
    .insert(boards)
    .values({
      id: EMPTY_BOARD_ID,
      title: "No active plan",
      task: "",
      status: "active",
      createdAt: now(),
      updatedAt: now(),
    })
    .run();

  return EMPTY_BOARD_ID;
}

export function ensureSeedData() {
  initializeDatabase();
  const boardId = ensureActiveBoard();
  const db = getDb();

  if (countTable("design_tokens") === 0) {
    db.insert(designTokens)
      .values([
        {
          id: "token-radius",
          name: "--radius",
          value: "0.625rem",
          category: "shape",
          scope: "global",
          status: "active",
          updatedAt: now(),
        },
        {
          id: "token-ready",
          name: "--status-ready",
          value: "oklch(0.70 0.15 237)",
          category: "status",
          scope: "kanban",
          status: "active",
          updatedAt: now(),
        },
        {
          id: "token-done",
          name: "--status-done",
          value: "oklch(0.72 0.16 152)",
          category: "status",
          scope: "kanban",
          status: "active",
          updatedAt: now(),
        },
      ])
      .run();
  }

  if (countTable("harness_profiles") === 0) {
    db.insert(harnessProfiles)
      .values({
        id: "harness-vibe-monitoring",
        name: "Vibe with Dashboard",
        description:
          "Project-local monitoring for LLM agent work. No prompt queue, heartbeat, or MCP sidecar.",
        skillsJson: JSON.stringify(["vibe-with-dashboard"]),
        mcpJson: JSON.stringify({}),
        instructions:
          "Use $vibe-with-dashboard before project work, keep the dashboard open, record phase-level activity, and avoid private reasoning in logs.",
        status: "active",
        updatedAt: now(),
      })
      .run();
  }

  if (countTable("subagents") === 0) {
    db.insert(subagents)
      .values([
        {
          id: "agent-reviewer",
          name: "dashboard-reviewer",
          description: "Plan, implementation, and risk review helper.",
          model: "agent-default",
          reasoningEffort: "medium",
          sandbox: "read-only",
          toolsJson: JSON.stringify(["shell", "rg"]),
          status: "draft",
          filePath: ".agents/subagents/dashboard-reviewer.md",
          updatedAt: now(),
        },
        {
          id: "agent-implementer",
          name: "dashboard-implementer",
          description: "Implementation helper for scoped project changes.",
          model: "agent-default",
          reasoningEffort: "high",
          sandbox: "workspace-write",
          toolsJson: JSON.stringify(["shell", "apply_patch", "tests"]),
          status: "draft",
          filePath: ".agents/subagents/dashboard-implementer.md",
          updatedAt: now(),
        },
      ])
      .run();
  }

  getSqlite()
    .prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (@key, @value, @updatedAt)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run({ key: "active_board_id", value: boardId, updatedAt: now() });

  const defaultSettings = [
    ["schema_version", "vibe-dashboard-v1"],
    ["dashboard_url", "http://127.0.0.1:3000"],
    ["launcher_status", "manual"],
    ["app_id", "vibe-with-dashboard"],
  ] as const;

  for (const [key, value] of defaultSettings) {
    getSqlite()
      .prepare(
        `INSERT INTO settings (key, value, updated_at)
         VALUES (@key, @value, @updatedAt)
         ON CONFLICT(key) DO NOTHING`
      )
      .run({ key, value, updatedAt: now() });
  }
}

export function resetSeedDataForTests() {
  initializeDatabase();
  const db = getDb();
  for (const table of [
    activityEntries,
    agentCheckpoints,
    cards,
    milestones,
    goals,
    boardArchives,
    boards,
    designTokens,
    harnessProfiles,
    subagents,
    settings,
  ]) {
    db.delete(table).run();
  }
  ensureSeedData();
}

export function getSeedSummary() {
  ensureSeedData();
  return {
    boards: getDb().select().from(boards).orderBy(asc(boards.createdAt)).all(),
    goals: getDb().select().from(goals).orderBy(asc(goals.createdAt)).all(),
    activities: getDb()
      .select()
      .from(activityEntries)
      .orderBy(desc(activityEntries.createdAt))
      .all(),
  };
}
