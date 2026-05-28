import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const boards = sqliteTable(
  "boards",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    task: text("task").notNull().default(""),
    translationsJson: text("translations_json").notNull().default("{}"),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    archivedAt: text("archived_at"),
  },
  (table) => [index("boards_status_idx").on(table.status)]
);

export const boardArchives = sqliteTable(
  "board_archives",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id").notNull(),
    title: text("title").notNull(),
    task: text("task").notNull().default(""),
    snapshotJson: text("snapshot_json").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index("board_archives_created_idx").on(table.createdAt)]
);

export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    translationsJson: text("translations_json").notNull().default("{}"),
    status: text("status").notNull().default("active"),
    priority: text("priority").notNull().default("medium"),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index("goals_board_idx").on(table.boardId)]
);

export const milestones = sqliteTable(
  "milestones",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    translationsJson: text("translations_json").notNull().default("{}"),
    status: text("status").notNull().default("planned"),
    priority: text("priority").notNull().default("medium"),
    dueDate: text("due_date"),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("milestones_board_idx").on(table.boardId),
    index("milestones_goal_idx").on(table.goalId),
  ]
);

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestones.id),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    translationsJson: text("translations_json").notNull().default("{}"),
    status: text("status").notNull().default("backlog"),
    priority: text("priority").notNull().default("medium"),
    owner: text("owner").notNull().default("agent"),
    size: text("size").notNull().default("M"),
    acceptanceCriteria: text("acceptance_criteria").notNull().default(""),
    verificationCommand: text("verification_command").notNull().default(""),
    dependsOnJson: text("depends_on_json").notNull().default("[]"),
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
    index("cards_board_idx").on(table.boardId),
    index("cards_milestone_idx").on(table.milestoneId),
    index("cards_status_idx").on(table.status),
    index("cards_priority_idx").on(table.priority),
  ]
);

export const activityEntries = sqliteTable(
  "activity_entries",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id),
    phase: text("phase").notNull(),
    source: text("source").notNull().default("agent"),
    status: text("status").notNull().default("done"),
    task: text("task").notNull().default(""),
    title: text("title").notNull(),
    message: text("message").notNull(),
    translationsJson: text("translations_json").notNull().default("{}"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("activity_board_idx").on(table.boardId),
    index("activity_created_idx").on(table.createdAt),
    index("activity_phase_idx").on(table.phase),
  ]
);

export const duckSuggestions = sqliteTable(
  "duck_suggestions",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id),
    keyword: text("keyword").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    detail: text("detail").notNull().default(""),
    actionPrompt: text("action_prompt").notNull().default(""),
    priority: text("priority").notNull().default("medium"),
    source: text("source").notNull().default("agent"),
    translationsJson: text("translations_json").notNull().default("{}"),
    readAt: text("read_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("duck_suggestions_board_idx").on(table.boardId),
    index("duck_suggestions_read_idx").on(table.readAt),
    index("duck_suggestions_priority_idx").on(table.priority),
  ]
);

export const agentCheckpoints = sqliteTable(
  "agent_checkpoints",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id),
    agent: text("agent").notNull().default("agent"),
    task: text("task").notNull().default(""),
    status: text("status").notNull().default("active"),
    summary: text("summary").notNull(),
    payloadJson: text("payload_json").notNull().default("{}"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("checkpoints_board_idx").on(table.boardId),
    index("checkpoints_agent_idx").on(table.agent),
    index("checkpoints_created_idx").on(table.createdAt),
  ]
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
  model: text("model").notNull().default("agent-default"),
  reasoningEffort: text("reasoning_effort").notNull().default("medium"),
  sandbox: text("sandbox").notNull().default("read-only"),
  toolsJson: text("tools_json").notNull().default("[]"),
  status: text("status").notNull().default("draft"),
  filePath: text("file_path").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
