import { randomUUID } from "node:crypto";

import { asc, desc } from "drizzle-orm";

import { getDb, getSqlite, initializeDatabase } from "@/lib/db/client";
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

const now = () => new Date().toISOString();

export function ensureSeedData() {
  initializeDatabase();

  const row = getSqlite()
    .prepare("SELECT COUNT(*) AS count FROM goals")
    .get() as { count: number };

  if (row.count > 0) return;

  const db = getDb();
  const goalId = "goal-dashboard";
  const m1 = "milestone-shell";
  const m2 = "milestone-loop";
  const m3 = "milestone-control-plane";
  const runId = "run-first-handshake";

  db.insert(goals).values({
    id: goalId,
    title: "My Project Dashboard",
    summary:
      "Codex와 상시 연결되는 로컬 agent-driven 통합 대시보드 구축.",
    status: "active",
    createdAt: now(),
    updatedAt: now(),
  }).run();

  db.insert(milestones)
    .values([
      {
        id: m1,
        goalId,
        title: "UI Shell",
        summary: "3-pane cockpit, seed data, 한국어 ops UI.",
        status: "active",
        position: 1,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: m2,
        goalId,
        title: "Codex Loop",
        summary: "HTTP MCP, adaptive heartbeat, Run/Event/Decision loop.",
        status: "planned",
        position: 2,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: m3,
        goalId,
        title: "Control Plane",
        summary: "GitHub, design tokens, harness, subagents 관리.",
        status: "planned",
        position: 3,
        createdAt: now(),
        updatedAt: now(),
      },
    ])
    .run();

  db.insert(cards)
    .values([
      {
        id: "card-cockpit",
        milestoneId: m1,
        title: "3-pane cockpit 완성",
        summary: "Plan, Live Session, Inspector를 한 화면에 배치.",
        status: "doing",
        priority: "high",
        position: 1,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: "card-sse",
        milestoneId: m2,
        title: "SSE progress stream 연결",
        summary: "Run/Event 변경 시 브라우저가 즉시 갱신.",
        status: "ready",
        priority: "high",
        position: 2,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: "card-mcp",
        milestoneId: m2,
        title: "Dashboard MCP tool contract",
        summary: "heartbeat, poll, report, decision, shutdown tools.",
        status: "ready",
        priority: "high",
        position: 3,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: "card-github",
        milestoneId: m3,
        title: "GitHub local-primary sync",
        summary: "gh CLI 재사용, issue/PR link와 승인 게이트.",
        status: "backlog",
        priority: "medium",
        position: 4,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: "card-harness",
        milestoneId: m3,
        title: "Project-local harness profile",
        summary: "전역 설정 없이 repo-local Codex skill/MCP/agent 정의 관리.",
        status: "backlog",
        priority: "medium",
        position: 5,
        createdAt: now(),
        updatedAt: now(),
      },
    ])
    .run();

  db.insert(runs).values({
    id: runId,
    cardId: "card-mcp",
    title: "Codex dashboard handshake",
    prompt:
      "Dashboard MCP에 연결되면 heartbeat를 보내고 현재 Run/Event/Decision loop 상태를 점검해줘.",
    mode: "plan",
    status: "queued",
    riskLevel: "low",
    approvalPolicy: "risk_gated",
    createdAt: now(),
    updatedAt: now(),
  }).run();

  db.insert(events)
    .values([
      {
        id: randomUUID(),
        runId,
        type: "run.created",
        source: "dashboard",
        severity: "info",
        title: "Seed Run 생성",
        message: "Codex 연결 확인용 첫 Run이 대기열에 들어갔다.",
        payloadJson: JSON.stringify({ runId }),
        createdAt: now(),
      },
      {
        id: randomUUID(),
        type: "system.ready",
        source: "dashboard",
        severity: "success",
        title: "Dashboard state ready",
        message: "SQLite seed data와 cockpit shell 준비 완료.",
        payloadJson: "{}",
        createdAt: now(),
      },
    ])
    .run();

  db.insert(decisions).values({
    id: "decision-notifications",
    runId,
    title: "브라우저 알림 활성화",
    body: "Agent 결정 요청을 탭 밖에서도 받을지 선택.",
    status: "open",
    optionsJson: JSON.stringify(["approve", "skip"]),
    createdAt: now(),
  }).run();

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

  db.insert(harnessProfiles).values({
    id: "harness-default",
    name: "Project Dashboard Agent",
    description: "Dashboard MCP와 project-local skill을 쓰는 기본 Codex profile.",
    skillsJson: JSON.stringify(["project-dashboard-agent"]),
    mcpJson: JSON.stringify({
      dashboard: "http://127.0.0.1:3333/mcp",
    }),
    instructions:
      "Read my_project_dashboard.md, poll dashboard MCP, report structured progress, use risk-gated approvals.",
    status: "active",
    updatedAt: now(),
  }).run();

  db.insert(subagents)
    .values([
      {
        id: "agent-reviewer",
        name: "dashboard-reviewer",
        description: "계획/코드/위험을 독립 검토하는 reviewer subagent.",
        model: "gpt-5-codex",
        reasoningEffort: "medium",
        sandbox: "read-only",
        toolsJson: JSON.stringify(["shell", "rg"]),
        status: "draft",
        filePath: ".codex/agents/dashboard-reviewer.toml",
        updatedAt: now(),
      },
      {
        id: "agent-implementer",
        name: "dashboard-implementer",
        description: "명령 범위 안에서 기능 구현을 맡는 implementer subagent.",
        model: "gpt-5-codex",
        reasoningEffort: "high",
        sandbox: "workspace-write",
        toolsJson: JSON.stringify(["shell", "apply_patch", "tests"]),
        status: "draft",
        filePath: ".codex/agents/dashboard-implementer.toml",
        updatedAt: now(),
      },
    ])
    .run();

  db.insert(codexSessions).values({
    id: "local-codex",
    label: "Local Codex Session",
    status: "offline",
    heartbeatIntervalSeconds: 30,
    notes: "Run `npm run dashboard`, then start Codex with the launch prompt.",
  }).run();

  db.insert(settings)
    .values([
      { key: "shutdown_requested", value: "false", updatedAt: now() },
      { key: "launcher_status", value: "manual", updatedAt: now() },
      { key: "mcp_url", value: "http://127.0.0.1:3333/mcp", updatedAt: now() },
    ])
    .run();
}

export function resetSeedDataForTests() {
  initializeDatabase();
  const db = getDb();
  for (const table of [
    events,
    decisions,
    codexSessions,
    runs,
    cards,
    milestones,
    goals,
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
    goals: getDb().select().from(goals).orderBy(asc(goals.createdAt)).all(),
    runs: getDb().select().from(runs).orderBy(desc(runs.createdAt)).all(),
  };
}
