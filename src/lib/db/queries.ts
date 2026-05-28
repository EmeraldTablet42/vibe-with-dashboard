import { randomUUID } from "node:crypto";

import { asc, desc, eq, inArray } from "drizzle-orm";

import { getDb, getSqlite, initializeDatabase } from "@/lib/db/client";
import { ensureSeedData } from "@/lib/db/seed";
import {
  cards,
  codexSessions,
  decisions,
  designTokens,
  events,
  goals,
  harnessProfiles,
  milestones,
  runs,
  settings,
  subagents,
} from "@/lib/db/schema";
import { getProjectHarnessInventory } from "@/lib/harness/project";
import { getGithubStatus, getRepoStatus, getWorkspaceFiles } from "@/lib/repo/git";
import { publishDashboardEvent } from "@/lib/realtime/bus";
import type { CardStatus, EventSeverity, RunMode, RunStatus } from "@/lib/types";

const now = () => new Date().toISOString();

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function makeRunTitle(prompt: string) {
  return prompt.replace(/\s+/g, " ").trim().slice(0, 84) || "Untitled Run";
}

export async function getDashboardSnapshot() {
  ensureSeedData();
  const db = getDb();

  const [
    goalRows,
    milestoneRows,
    cardRows,
    runRows,
    eventRows,
    decisionRows,
    tokenRows,
    harnessRows,
    subagentRows,
    sessionRows,
    settingRows,
    repoStatus,
    githubStatus,
    workspaceFiles,
    harnessInventory,
  ] = await Promise.all([
    Promise.resolve(db.select().from(goals).orderBy(asc(goals.createdAt)).all()),
    Promise.resolve(
      db.select().from(milestones).orderBy(asc(milestones.position)).all()
    ),
    Promise.resolve(db.select().from(cards).orderBy(asc(cards.position)).all()),
    Promise.resolve(db.select().from(runs).orderBy(desc(runs.createdAt)).limit(30).all()),
    Promise.resolve(
      db.select().from(events).orderBy(desc(events.createdAt)).limit(80).all()
    ),
    Promise.resolve(
      db.select().from(decisions).orderBy(desc(decisions.createdAt)).limit(20).all()
    ),
    Promise.resolve(db.select().from(designTokens).orderBy(asc(designTokens.name)).all()),
    Promise.resolve(db.select().from(harnessProfiles).orderBy(asc(harnessProfiles.name)).all()),
    Promise.resolve(db.select().from(subagents).orderBy(asc(subagents.name)).all()),
    Promise.resolve(db.select().from(codexSessions).orderBy(desc(codexSessions.lastSeenAt)).all()),
    Promise.resolve(db.select().from(settings).all()),
    getRepoStatus(),
    getGithubStatus(),
    getWorkspaceFiles(),
    getProjectHarnessInventory(),
  ]);

  const settingsMap = Object.fromEntries(
    settingRows.map((setting) => [setting.key, setting.value])
  );

  return {
    generatedAt: now(),
    goals: goalRows.map((goal) => ({
      ...goal,
      milestones: milestoneRows
        .filter((milestone) => milestone.goalId === goal.id)
        .map((milestone) => ({
          ...milestone,
          cards: cardRows.filter((card) => card.milestoneId === milestone.id),
        })),
    })),
    cards: cardRows,
    runs: runRows,
    events: eventRows.map((event) => ({
      ...event,
      payload: parseJson(event.payloadJson, {}),
    })),
    decisions: decisionRows.map((decision) => ({
      ...decision,
      options: parseJson<string[]>(decision.optionsJson, []),
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
    sessions: sessionRows,
    settings: settingsMap,
    repoStatus,
    githubStatus,
    workspaceFiles,
    harnessInventory,
    launch: {
      dashboardUrl: "http://127.0.0.1:3000",
      mcpUrl: settingsMap.mcp_url ?? "http://127.0.0.1:3333/mcp",
      command: "Codex Goal mode에서 my_project_dashboard.md 실행",
    },
  };
}

export function addEvent(input: {
  runId?: string | null;
  type: string;
  source?: string;
  severity?: EventSeverity;
  title: string;
  message: string;
  payload?: unknown;
}) {
  ensureSeedData();
  const id = randomUUID();
  getDb()
    .insert(events)
    .values({
      id,
      runId: input.runId ?? null,
      type: input.type,
      source: input.source ?? "dashboard",
      severity: input.severity ?? "info",
      title: input.title,
      message: input.message,
      payloadJson: JSON.stringify(input.payload ?? {}),
      createdAt: now(),
    })
    .run();

  publishDashboardEvent({ kind: "event", id, message: input.title });
  return id;
}

export function createRun(input: {
  prompt: string;
  mode?: RunMode;
  cardId?: string | null;
  title?: string;
  riskLevel?: "low" | "normal" | "high";
}) {
  ensureSeedData();
  const id = randomUUID();
  const title = input.title ?? makeRunTitle(input.prompt);

  getDb()
    .insert(runs)
    .values({
      id,
      cardId: input.cardId ?? null,
      title,
      prompt: input.prompt,
      mode: input.mode ?? "standard",
      status: "queued",
      riskLevel: input.riskLevel ?? "normal",
      approvalPolicy: "risk_gated",
      createdAt: now(),
      updatedAt: now(),
    })
    .run();

  addEvent({
    runId: id,
    type: "run.created",
    severity: "info",
    title: "Run 생성",
    message: title,
    payload: { mode: input.mode ?? "standard", cardId: input.cardId ?? null },
  });

  publishDashboardEvent({ kind: "run", id, message: "Run queued" });
  return getRunById(id);
}

export function getRunById(id: string) {
  ensureSeedData();
  return getDb().select().from(runs).where(eq(runs.id, id)).get();
}

export function moveCard(cardId: string, status: CardStatus) {
  ensureSeedData();
  getDb()
    .update(cards)
    .set({ status, updatedAt: now() })
    .where(eq(cards.id, cardId))
    .run();

  addEvent({
    type: "card.moved",
    severity: "info",
    title: "Card 이동",
    message: `${cardId} -> ${status}`,
    payload: { cardId, status },
  });
  publishDashboardEvent({ kind: "card", id: cardId, message: status });
}

export function resolveDecision(id: string, status: "approved" | "rejected" | "resolved") {
  ensureSeedData();
  getDb()
    .update(decisions)
    .set({ status, resolvedAt: now() })
    .where(eq(decisions.id, id))
    .run();

  addEvent({
    type: "decision.resolved",
    severity: status === "approved" ? "success" : "warning",
    title: "Decision 처리",
    message: `${id} -> ${status}`,
    payload: { id, status },
  });
  publishDashboardEvent({ kind: "decision", id, message: status });
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

export function requestShutdown(source = "dashboard") {
  ensureSeedData();
  upsertSetting("shutdown_requested", "true");
  addEvent({
    type: "system.shutdown_requested",
    source,
    severity: "warning",
    title: "Graceful shutdown 요청",
    message: "진행 중 Run은 안전 지점에서 정리 후 heartbeat를 종료한다.",
  });
  publishDashboardEvent({
    kind: "shutdown",
    message: "Graceful shutdown requested",
  });
}

export function heartbeat(input: {
  sessionId?: string;
  label?: string;
  currentRunId?: string | null;
  notes?: string;
}) {
  ensureSeedData();
  const id = input.sessionId || "local-codex";
  const shutdownRequested = getSetting("shutdown_requested", "false") === "true";
  const runningCount = getSqlite()
    .prepare(
      "SELECT COUNT(*) AS count FROM runs WHERE status IN ('queued', 'running', 'waiting_approval')"
    )
    .get() as { count: number };
  const interval = runningCount.count > 0 ? 5 : 45;

  getSqlite()
    .prepare(
      `INSERT INTO codex_sessions
        (id, label, status, last_seen_at, current_run_id, heartbeat_interval_seconds, notes)
       VALUES (@id, @label, @status, @lastSeenAt, @currentRunId, @interval, @notes)
       ON CONFLICT(id) DO UPDATE SET
        label = excluded.label,
        status = excluded.status,
        last_seen_at = excluded.last_seen_at,
        current_run_id = excluded.current_run_id,
        heartbeat_interval_seconds = excluded.heartbeat_interval_seconds,
        notes = excluded.notes`
    )
    .run({
      id,
      label: input.label || "Local Codex Session",
      status: shutdownRequested ? "stopping" : "online",
      lastSeenAt: now(),
      currentRunId: input.currentRunId ?? null,
      interval,
      notes: input.notes ?? "",
    });

  publishDashboardEvent({ kind: "heartbeat", id, message: "Codex heartbeat" });
  return {
    sessionId: id,
    shutdownRequested,
    heartbeatIntervalSeconds: interval,
    pendingWork: runningCount.count,
  };
}

export function pollNextRun(sessionId = "local-codex") {
  ensureSeedData();
  if (getSetting("shutdown_requested", "false") === "true") {
    return { run: null, shutdownRequested: true };
  }

  const db = getDb();
  const nextRun = db
    .select()
    .from(runs)
    .where(inArray(runs.status, ["queued"]))
    .orderBy(asc(runs.createdAt))
    .get();

  if (!nextRun) {
    heartbeat({ sessionId });
    return { run: null, shutdownRequested: false };
  }

  db.update(runs)
    .set({ status: "running", startedAt: now(), updatedAt: now() })
    .where(eq(runs.id, nextRun.id))
    .run();

  heartbeat({ sessionId, currentRunId: nextRun.id });
  addEvent({
    runId: nextRun.id,
    type: "run.started",
    source: "codex",
    severity: "info",
    title: "Run 시작",
    message: nextRun.title,
    payload: { sessionId },
  });

  return { run: getRunById(nextRun.id), shutdownRequested: false };
}

export function reportProgress(input: {
  runId?: string | null;
  type?: string;
  severity?: EventSeverity;
  title: string;
  message: string;
  payload?: unknown;
}) {
  ensureSeedData();
  if (input.runId) {
    getDb()
      .update(runs)
      .set({ updatedAt: now() })
      .where(eq(runs.id, input.runId))
      .run();
  }

  return addEvent({
    runId: input.runId,
    type: input.type ?? "run.progress",
    source: "codex",
    severity: input.severity ?? "info",
    title: input.title,
    message: input.message,
    payload: input.payload,
  });
}

export function requestDecision(input: {
  runId?: string | null;
  title: string;
  body: string;
  options?: string[];
}) {
  ensureSeedData();
  const id = randomUUID();
  getDb()
    .insert(decisions)
    .values({
      id,
      runId: input.runId ?? null,
      title: input.title,
      body: input.body,
      status: "open",
      optionsJson: JSON.stringify(input.options ?? ["approve", "reject"]),
      createdAt: now(),
    })
    .run();

  if (input.runId) {
    getDb()
      .update(runs)
      .set({ status: "waiting_approval", updatedAt: now() })
      .where(eq(runs.id, input.runId))
      .run();
  }

  addEvent({
    runId: input.runId,
    type: "decision.requested",
    source: "codex",
    severity: "warning",
    title: input.title,
    message: input.body,
    payload: { decisionId: id, options: input.options },
  });
  publishDashboardEvent({ kind: "decision", id, message: input.title });
  return { decisionId: id };
}

export function completeRun(input: {
  runId: string;
  status?: Extract<RunStatus, "completed" | "failed" | "cancelled">;
  result: string;
}) {
  ensureSeedData();
  const status = input.status ?? "completed";
  getDb()
    .update(runs)
    .set({
      status,
      result: input.result,
      completedAt: now(),
      updatedAt: now(),
    })
    .where(eq(runs.id, input.runId))
    .run();

  addEvent({
    runId: input.runId,
    type: `run.${status}`,
    source: "codex",
    severity: status === "completed" ? "success" : "error",
    title: status === "completed" ? "Run 완료" : "Run 종료",
    message: input.result,
  });
  publishDashboardEvent({ kind: "run", id: input.runId, message: status });
  return getRunById(input.runId);
}

export function syncPlanUpdate(input: {
  title: string;
  message: string;
  payload?: unknown;
}) {
  ensureSeedData();
  const id = addEvent({
    type: "plan.synced",
    source: "codex",
    severity: "success",
    title: input.title,
    message: input.message,
    payload: input.payload,
  });
  return { eventId: id };
}
