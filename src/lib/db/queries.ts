import { randomUUID } from "node:crypto";

import { asc, desc, eq } from "drizzle-orm";

import { getDb, getSqlite, initializeDatabase } from "@/lib/db/client";
import { ensureSeedData } from "@/lib/db/seed";
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
import { getProjectHarnessInventory } from "@/lib/harness/project";
import { getGithubStatus, getRepoStatus, getWorkspaceFiles } from "@/lib/repo/git";
import { publishDashboardEvent } from "@/lib/realtime/bus";
import type {
  ActivityPhase,
  ActivityStatus,
  CardPriority,
  CardStatus,
  GoalStatus,
  MilestoneStatus,
} from "@/lib/types";

const now = () => new Date().toISOString();

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function compactPatch<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function getSettingsMap() {
  return Object.fromEntries(
    getDb()
      .select()
      .from(settings)
      .all()
      .map((setting) => [setting.key, setting.value])
  );
}

function getActiveBoardRow() {
  ensureSeedData();
  const settingsMap = getSettingsMap();
  const configured = settingsMap.active_board_id
    ? getDb()
        .select()
        .from(boards)
        .where(eq(boards.id, settingsMap.active_board_id))
        .get()
    : undefined;

  if (configured?.status === "active") return configured;

  const active = getDb()
    .select()
    .from(boards)
    .where(eq(boards.status, "active"))
    .orderBy(desc(boards.updatedAt))
    .get();

  if (!active) {
    initializeDatabase();
    const id = randomUUID();
    getDb()
      .insert(boards)
      .values({
        id,
        title: "No active plan",
        task: "",
        status: "active",
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
    upsertSetting("active_board_id", id);
    return getDb().select().from(boards).where(eq(boards.id, id)).get()!;
  }

  upsertSetting("active_board_id", active.id);
  return active;
}

function getBoardRows(boardId: string) {
  const db = getDb();
  const goalRows = db
    .select()
    .from(goals)
    .where(eq(goals.boardId, boardId))
    .orderBy(asc(goals.position))
    .all();
  const milestoneRows = db
    .select()
    .from(milestones)
    .where(eq(milestones.boardId, boardId))
    .orderBy(asc(milestones.position))
    .all();
  const cardRows = db
    .select()
    .from(cards)
    .where(eq(cards.boardId, boardId))
    .orderBy(asc(cards.position))
    .all();
  const activityRows = db
    .select()
    .from(activityEntries)
    .where(eq(activityEntries.boardId, boardId))
    .orderBy(desc(activityEntries.createdAt))
    .limit(80)
    .all();
  const checkpointRows = db
    .select()
    .from(agentCheckpoints)
    .where(eq(agentCheckpoints.boardId, boardId))
    .orderBy(desc(agentCheckpoints.createdAt))
    .limit(20)
    .all();

  const cardsWithDependencies = cardRows.map((card) => ({
    ...card,
    dependsOn: parseJson<string[]>(card.dependsOnJson, []),
  }));

  return {
    goalRows,
    milestoneRows,
    cardRows,
    cardsWithDependencies,
    activityRows,
    checkpointRows,
  };
}

export async function getDashboardSnapshot() {
  const activeBoard = getActiveBoardRow();
  const db = getDb();
  const {
    goalRows,
    milestoneRows,
    cardsWithDependencies,
    activityRows,
    checkpointRows,
  } = getBoardRows(activeBoard.id);

  const [
    tokenRows,
    harnessRows,
    subagentRows,
    archiveRows,
    settingRows,
    repoStatus,
    githubStatus,
    workspaceFiles,
    harnessInventory,
  ] = await Promise.all([
    Promise.resolve(db.select().from(designTokens).orderBy(asc(designTokens.name)).all()),
    Promise.resolve(db.select().from(harnessProfiles).orderBy(asc(harnessProfiles.name)).all()),
    Promise.resolve(db.select().from(subagents).orderBy(asc(subagents.name)).all()),
    Promise.resolve(
      db
        .select()
        .from(boardArchives)
        .orderBy(desc(boardArchives.createdAt))
        .limit(20)
        .all()
    ),
    Promise.resolve(db.select().from(settings).all()),
    getRepoStatus(),
    getGithubStatus(),
    getWorkspaceFiles(),
    getProjectHarnessInventory(),
  ]);

  const settingsMap = Object.fromEntries(
    settingRows.map((setting) => [setting.key, setting.value])
  );
  const hasCards = cardsWithDependencies.length > 0;
  const archiveReady =
    hasCards &&
    cardsWithDependencies.every((card) => card.status === "done") &&
    activityRows.some((activity) => activity.phase === "result");

  return {
    generatedAt: now(),
    appId: "vibe-with-dashboard",
    board: {
      ...activeBoard,
      isEmpty: goalRows.length === 0 && cardsWithDependencies.length === 0,
      archiveReady,
    },
    archives: archiveRows.map((archive) => ({
      ...archive,
      snapshot: parseJson<Record<string, unknown>>(archive.snapshotJson, {}),
    })),
    goals: goalRows.map((goal) => ({
      ...goal,
      milestones: milestoneRows
        .filter((milestone) => milestone.goalId === goal.id)
        .map((milestone) => ({
          ...milestone,
          cards: cardsWithDependencies.filter(
            (card) => card.milestoneId === milestone.id
          ),
        })),
    })),
    cards: cardsWithDependencies,
    activityEntries: activityRows.map((activity) => ({
      ...activity,
      metadata: parseJson<Record<string, unknown>>(activity.metadataJson, {}),
    })),
    agentCheckpoints: checkpointRows.map((checkpoint) => ({
      ...checkpoint,
      payload: parseJson<Record<string, unknown>>(checkpoint.payloadJson, {}),
    })),
    designTokens: tokenRows,
    harnessProfiles: harnessRows.map((profile) => ({
      ...profile,
      skills: parseJson<string[]>(profile.skillsJson, []),
      mcp: parseJson<Record<string, string>>(profile.mcpJson, {}),
    })),
    subagents: subagentRows.map((agent) => ({
      ...agent,
      tools: parseJson<string[]>(agent.toolsJson, []),
    })),
    settings: settingsMap,
    repoStatus,
    githubStatus,
    workspaceFiles,
    harnessInventory,
    launch: {
      dashboardUrl: settingsMap.dashboard_url ?? "http://127.0.0.1:3000",
      command: "$vibe-with-dashboard <user task>",
    },
  };
}

export function upsertPlan(input: {
  task: string;
  title?: string;
  summary?: string;
  source?: string;
  cards?: Array<{
    title: string;
    summary?: string;
    priority?: CardPriority;
    status?: CardStatus;
    size?: string;
    acceptanceCriteria?: string;
    verificationCommand?: string;
  }>;
}) {
  const board = getActiveBoardRow();
  const title = input.title?.trim() || input.task.trim() || "Untitled task";
  const summary =
    input.summary?.trim() ||
    "Agent 작업 계획이 생성되면 Plan과 Kanban에서 진행 상태를 관측한다.";
  const db = getDb();

  db.update(boards)
    .set({
      title,
      task: input.task,
      status: "active",
      updatedAt: now(),
    })
    .where(eq(boards.id, board.id))
    .run();

  let goal = db
    .select()
    .from(goals)
    .where(eq(goals.boardId, board.id))
    .orderBy(asc(goals.position))
    .get();

  if (!goal) {
    const goalId = randomUUID();
    db.insert(goals)
      .values({
        id: goalId,
        boardId: board.id,
        title,
        summary,
        status: "active",
        priority: "high",
        position: 1,
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
    goal = db.select().from(goals).where(eq(goals.id, goalId)).get();
  } else {
    db.update(goals)
      .set({ title, summary, status: "active", updatedAt: now() })
      .where(eq(goals.id, goal.id))
      .run();
  }

  if (!goal) throw new Error("failed to create goal");

  let milestone = db
    .select()
    .from(milestones)
    .where(eq(milestones.boardId, board.id))
    .orderBy(asc(milestones.position))
    .get();

  if (!milestone) {
    const milestoneId = randomUUID();
    db.insert(milestones)
      .values({
        id: milestoneId,
        boardId: board.id,
        goalId: goal.id,
        title: "Current work",
        summary,
        status: "active",
        priority: "high",
        position: 1,
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
    milestone = db.select().from(milestones).where(eq(milestones.id, milestoneId)).get();
  }

  if (!milestone) throw new Error("failed to create milestone");

  const existingCards = db
    .select()
    .from(cards)
    .where(eq(cards.boardId, board.id))
    .all();
  const requestedCards =
    input.cards && input.cards.length > 0
      ? input.cards
      : [
          {
            title,
            summary,
            priority: "high" as const,
            status: "ready" as const,
            size: "M",
          },
        ];

  for (const [index, card] of requestedCards.entries()) {
    if (existingCards.some((item) => item.title === card.title)) continue;

    db.insert(cards)
      .values({
        id: randomUUID(),
        boardId: board.id,
        milestoneId: milestone.id,
        title: card.title,
        summary: card.summary || summary,
        status: card.status ?? "ready",
        priority: card.priority ?? "medium",
        size: card.size ?? "M",
        acceptanceCriteria: card.acceptanceCriteria ?? "",
        verificationCommand: card.verificationCommand ?? "",
        dependsOnJson: JSON.stringify([]),
        position: existingCards.length + index + 1,
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
  }

  addActivity({
    phase: "plan",
    source: input.source ?? "agent",
    status: "done",
    task: input.task,
    title: "Plan updated",
    message: title,
    metadata: { cards: requestedCards.length },
  });

  publishDashboardEvent({ kind: "snapshot", id: board.id, message: "plan" });
  return { boardId: board.id };
}

export function archiveActiveBoard() {
  const board = getActiveBoardRow();
  const {
    goalRows,
    milestoneRows,
    cardsWithDependencies,
    activityRows,
    checkpointRows,
  } = getBoardRows(board.id);
  const hasCards = cardsWithDependencies.length > 0;
  const hasResult = activityRows.some((activity) => activity.phase === "result");
  const allDone = hasCards && cardsWithDependencies.every((card) => card.status === "done");

  if (!hasCards || !allDone || !hasResult) {
    return {
      archived: false,
      reason: !hasCards
        ? "no-cards"
        : !allDone
          ? "cards-not-done"
          : "missing-result",
    };
  }

  const archiveId = randomUUID();
  const archivedAt = now();
  getDb()
    .insert(boardArchives)
    .values({
      id: archiveId,
      boardId: board.id,
      title: board.title,
      task: board.task,
      snapshotJson: JSON.stringify({
        board,
        goals: goalRows,
        milestones: milestoneRows,
        cards: cardsWithDependencies,
        activityEntries: activityRows,
        agentCheckpoints: checkpointRows,
        archivedAt,
      }),
      createdAt: archivedAt,
    })
    .run();

  getDb()
    .update(boards)
    .set({ status: "archived", archivedAt, updatedAt: archivedAt })
    .where(eq(boards.id, board.id))
    .run();

  const nextBoardId = randomUUID();
  getDb()
    .insert(boards)
    .values({
      id: nextBoardId,
      title: "No active plan",
      task: "",
      status: "active",
      createdAt: archivedAt,
      updatedAt: archivedAt,
    })
    .run();
  upsertSetting("active_board_id", nextBoardId);

  publishDashboardEvent({ kind: "snapshot", id: nextBoardId, message: "archive" });
  return { archived: true, archiveId, boardId: nextBoardId };
}

export function addActivity(input: {
  phase: ActivityPhase;
  source?: string;
  status?: ActivityStatus;
  task?: string;
  title: string;
  message: string;
  metadata?: unknown;
}) {
  const board = getActiveBoardRow();
  const id = randomUUID();
  getDb()
    .insert(activityEntries)
    .values({
      id,
      boardId: board.id,
      phase: input.phase,
      source: input.source ?? "agent",
      status: input.status ?? "done",
      task: input.task ?? "",
      title: input.title,
      message: input.message,
      metadataJson: JSON.stringify(input.metadata ?? {}),
      createdAt: now(),
    })
    .run();

  publishDashboardEvent({ kind: "activity", id, message: input.title });
  return getActivityById(id);
}

export function getActivityById(id: string) {
  ensureSeedData();
  const row = getDb()
    .select()
    .from(activityEntries)
    .where(eq(activityEntries.id, id))
    .get();

  if (!row) return undefined;
  return {
    ...row,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
  };
}

export function addAgentCheckpoint(input: {
  agent?: string;
  task?: string;
  status?: "active" | "idle" | "done" | "failed";
  summary: string;
  payload?: unknown;
}) {
  const board = getActiveBoardRow();
  const id = randomUUID();
  getDb()
    .insert(agentCheckpoints)
    .values({
      id,
      boardId: board.id,
      agent: input.agent ?? "agent",
      task: input.task ?? "",
      status: input.status ?? "active",
      summary: input.summary,
      payloadJson: JSON.stringify(input.payload ?? {}),
      createdAt: now(),
    })
    .run();

  publishDashboardEvent({ kind: "checkpoint", id, message: input.summary });
  return id;
}

export function updateCard(
  cardId: string,
  input: {
    title?: string;
    summary?: string;
    status?: CardStatus;
    priority?: CardPriority;
    position?: number;
  }
) {
  ensureSeedData();
  const card = getDb().select().from(cards).where(eq(cards.id, cardId)).get();
  const patch = compactPatch({ ...input, updatedAt: now() });
  getDb().update(cards).set(patch).where(eq(cards.id, cardId)).run();

  if (card) {
    addActivity({
      phase: "implement",
      source: "dashboard",
      status: "done",
      task: cardId,
      title: "Card updated",
      message: `${card.title} 상태가 갱신되었다.`,
      metadata: input,
    });
  }
  publishDashboardEvent({ kind: "card", id: cardId, message: "updated" });
}

export function updateGoal(
  goalId: string,
  input: {
    title?: string;
    summary?: string;
    status?: GoalStatus;
    priority?: CardPriority;
    position?: number;
  }
) {
  ensureSeedData();
  const patch = compactPatch({ ...input, updatedAt: now() });
  getDb().update(goals).set(patch).where(eq(goals.id, goalId)).run();
  publishDashboardEvent({ kind: "goal", id: goalId, message: "updated" });
}

export function updateMilestone(
  milestoneId: string,
  input: {
    title?: string;
    summary?: string;
    status?: MilestoneStatus;
    priority?: CardPriority;
    position?: number;
  }
) {
  ensureSeedData();
  const patch = compactPatch({ ...input, updatedAt: now() });
  getDb()
    .update(milestones)
    .set(patch)
    .where(eq(milestones.id, milestoneId))
    .run();
  publishDashboardEvent({
    kind: "milestone",
    id: milestoneId,
    message: "updated",
  });
}

export function upsertSetting(key: string, value: string) {
  initializeDatabase();
  getSqlite()
    .prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (@key, @value, @updatedAt)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run({ key, value, updatedAt: now() });
}

export function getSetting(key: string, fallback = "") {
  initializeDatabase();
  const row = getDb().select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? fallback;
}
