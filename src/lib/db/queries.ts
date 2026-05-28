import { randomUUID } from "node:crypto";

import { asc, desc, eq } from "drizzle-orm";

import { getDb, getSqlite, initializeDatabase } from "@/lib/db/client";
import { ensureSeedData } from "@/lib/db/seed";
import {
  activityEntries,
  agentCheckpoints,
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

export async function getDashboardSnapshot() {
  ensureSeedData();
  const db = getDb();

  const [
    goalRows,
    milestoneRows,
    cardRows,
    activityRows,
    checkpointRows,
    tokenRows,
    harnessRows,
    subagentRows,
    settingRows,
    repoStatus,
    githubStatus,
    workspaceFiles,
    harnessInventory,
  ] = await Promise.all([
    Promise.resolve(db.select().from(goals).orderBy(asc(goals.position)).all()),
    Promise.resolve(
      db.select().from(milestones).orderBy(asc(milestones.position)).all()
    ),
    Promise.resolve(db.select().from(cards).orderBy(asc(cards.position)).all()),
    Promise.resolve(
      db
        .select()
        .from(activityEntries)
        .orderBy(desc(activityEntries.createdAt))
        .limit(80)
        .all()
    ),
    Promise.resolve(
      db
        .select()
        .from(agentCheckpoints)
        .orderBy(desc(agentCheckpoints.createdAt))
        .limit(20)
        .all()
    ),
    Promise.resolve(db.select().from(designTokens).orderBy(asc(designTokens.name)).all()),
    Promise.resolve(db.select().from(harnessProfiles).orderBy(asc(harnessProfiles.name)).all()),
    Promise.resolve(db.select().from(subagents).orderBy(asc(subagents.name)).all()),
    Promise.resolve(db.select().from(settings).all()),
    getRepoStatus(),
    getGithubStatus(),
    getWorkspaceFiles(),
    getProjectHarnessInventory(),
  ]);

  const settingsMap = Object.fromEntries(
    settingRows.map((setting) => [setting.key, setting.value])
  );

  const cardsWithDependencies = cardRows.map((card) => ({
    ...card,
    dependsOn: parseJson<string[]>(card.dependsOnJson, []),
  }));

  return {
    generatedAt: now(),
    appId: "codex-dashboard",
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
      command: "$codex-dashboard <user task>",
    },
  };
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
  ensureSeedData();
  const id = randomUUID();
  getDb()
    .insert(activityEntries)
    .values({
      id,
      phase: input.phase,
      source: input.source ?? "codex",
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
  ensureSeedData();
  const id = randomUUID();
  getDb()
    .insert(agentCheckpoints)
    .values({
      id,
      agent: input.agent ?? "codex",
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
  const patch = compactPatch({ ...input, updatedAt: now() });
  getDb().update(cards).set(patch).where(eq(cards.id, cardId)).run();

  addActivity({
    phase: "implement",
    source: "dashboard",
    status: "done",
    task: cardId,
    title: "Card updated",
    message: `${cardId} 상태가 갱신되었다.`,
    metadata: input,
  });
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
  ensureSeedData();
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
