import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const milestones = sqliteTable(
  "milestones",
  {
    id: text("id").primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    status: text("status").notNull().default("planned"),
    dueDate: text("due_date"),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index("milestones_goal_idx").on(table.goalId)]
);

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestones.id),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    status: text("status").notNull().default("backlog"),
    priority: text("priority").notNull().default("medium"),
    owner: text("owner").notNull().default("agent"),
    position: integer("position").notNull().default(0),
    githubIssueUrl: text("github_issue_url"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("cards_milestone_idx").on(table.milestoneId),
    index("cards_status_idx").on(table.status),
  ]
);

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id").references(() => cards.id),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    mode: text("mode").notNull().default("standard"),
    status: text("status").notNull().default("queued"),
    riskLevel: text("risk_level").notNull().default("normal"),
    approvalPolicy: text("approval_policy").notNull().default("risk_gated"),
    result: text("result"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("runs_card_idx").on(table.cardId),
    index("runs_status_idx").on(table.status),
  ]
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").references(() => runs.id),
    type: text("type").notNull(),
    source: text("source").notNull().default("dashboard"),
    severity: text("severity").notNull().default("info"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    payloadJson: text("payload_json").notNull().default("{}"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("events_run_idx").on(table.runId),
    index("events_created_idx").on(table.createdAt),
  ]
);

export const decisions = sqliteTable(
  "decisions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").references(() => runs.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("open"),
    optionsJson: text("options_json").notNull().default("[]"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    resolvedAt: text("resolved_at"),
  },
  (table) => [index("decisions_status_idx").on(table.status)]
);

export const designTokens = sqliteTable("design_tokens", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  value: text("value").notNull(),
  category: text("category").notNull(),
  scope: text("scope").notNull().default("global"),
  status: text("status").notNull().default("draft"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const harnessProfiles = sqliteTable("harness_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  skillsJson: text("skills_json").notNull().default("[]"),
  mcpJson: text("mcp_json").notNull().default("{}"),
  instructions: text("instructions").notNull(),
  status: text("status").notNull().default("active"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const subagents = sqliteTable("subagents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  model: text("model").notNull().default("gpt-5-codex"),
  reasoningEffort: text("reasoning_effort").notNull().default("medium"),
  sandbox: text("sandbox").notNull().default("read-only"),
  toolsJson: text("tools_json").notNull().default("[]"),
  status: text("status").notNull().default("draft"),
  filePath: text("file_path").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const codexSessions = sqliteTable("codex_sessions", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  status: text("status").notNull().default("offline"),
  lastSeenAt: text("last_seen_at"),
  currentRunId: text("current_run_id").references(() => runs.id),
  heartbeatIntervalSeconds: integer("heartbeat_interval_seconds")
    .notNull()
    .default(30),
  notes: text("notes").notNull().default(""),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

