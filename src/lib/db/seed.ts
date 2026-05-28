import { randomUUID } from "node:crypto";

import { asc, desc } from "drizzle-orm";

import { getDb, getSqlite, initializeDatabase } from "@/lib/db/client";
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

const now = () => new Date().toISOString();

export function ensureSeedData() {
  initializeDatabase();

  const row = getSqlite()
    .prepare("SELECT COUNT(*) AS count FROM goals")
    .get() as { count: number };

  if (row.count > 0) return;

  const db = getDb();
  const goalId = "goal-monitoring-dashboard";
  const m1 = "milestone-monitor";
  const m2 = "milestone-skill";
  const m3 = "milestone-harness";

  db.insert(goals)
    .values({
      id: goalId,
      title: "Codex Dashboard Monitoring",
      summary:
        "Repo-local skill이 작업 진행을 기록하고 웹 대시보드는 계획, 칸반, activity를 관측한다.",
      status: "active",
      priority: "high",
      position: 1,
      createdAt: now(),
      updatedAt: now(),
    })
    .run();

  db.insert(milestones)
    .values([
      {
        id: m1,
        goalId,
        title: "Monitoring UI",
        summary: "Plan, vertical Kanban, Activity Timeline, 접힘 Inspector.",
        status: "active",
        priority: "high",
        position: 1,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: m2,
        goalId,
        title: "Repo-local Skill",
        summary: "$codex-dashboard가 서버 준비, 브라우저 오픈, 단계별 기록을 담당.",
        status: "active",
        priority: "high",
        position: 2,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: m3,
        goalId,
        title: "Harness Snapshot",
        summary: "Repo, GitHub, design token, skill, MCP, subagent 상태를 읽기 중심으로 표시.",
        status: "planned",
        priority: "medium",
        position: 3,
        createdAt: now(),
        updatedAt: now(),
      },
    ])
    .run();

  db.insert(cards)
    .values([
      {
        id: "card-monitor-shell",
        milestoneId: m1,
        title: "모니터링 cockpit 고정",
        summary: "명령 입력 UI를 제거하고 진행 관측 중심 화면으로 전환.",
        status: "doing",
        priority: "high",
        size: "M",
        acceptanceCriteria: "Prompt box, Run, Decision, heartbeat UI가 보이지 않는다.",
        verificationCommand: "npm run e2e",
        dependsOnJson: JSON.stringify([]),
        position: 1,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: "card-kanban-axis",
        milestoneId: m1,
        title: "의미 축 Kanban",
        summary: "세로축은 실행 단계, 가로축은 우선순위로 표시한다.",
        status: "ready",
        priority: "high",
        size: "S",
        acceptanceCriteria: "Backlog→Done 행과 High/Medium/Low 열이 동시에 보인다.",
        verificationCommand: "npm run e2e",
        dependsOnJson: JSON.stringify(["card-monitor-shell"]),
        position: 2,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: "card-skill-bootstrap",
        milestoneId: m2,
        title: "$codex-dashboard skill",
        summary: "작업 전 dashboard:ensure 실행, URL 안내, 기본 브라우저 오픈.",
        status: "ready",
        priority: "high",
        size: "M",
        acceptanceCriteria: "동일 dashboard는 재사용하고 다른 앱 포트 충돌은 우회한다.",
        verificationCommand: "npm run test",
        dependsOnJson: JSON.stringify(["card-monitor-shell"]),
        position: 3,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: "card-activity-api",
        milestoneId: m2,
        title: "Agent activity 기록",
        summary: "start, plan, implement, verify, result/fail 단계를 timeline에 기록.",
        status: "ready",
        priority: "medium",
        size: "S",
        acceptanceCriteria: "POST /api/agent/activity 후 UI timeline이 갱신된다.",
        verificationCommand: "npm run test",
        dependsOnJson: JSON.stringify(["card-skill-bootstrap"]),
        position: 4,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: "card-harness-monitor",
        milestoneId: m3,
        title: "Harness monitoring",
        summary: "Skills, MCP config, subagents, repo/GitHub 상태를 Inspector에서 확인.",
        status: "backlog",
        priority: "medium",
        size: "M",
        acceptanceCriteria: "관리 버튼 없이 snapshot 정보만 표시된다.",
        verificationCommand: "npm run e2e",
        dependsOnJson: JSON.stringify(["card-activity-api"]),
        position: 5,
        createdAt: now(),
        updatedAt: now(),
      },
    ])
    .run();

  db.insert(activityEntries)
    .values([
      {
        id: randomUUID(),
        phase: "start",
        source: "dashboard",
        status: "done",
        task: "bootstrap",
        title: "Monitoring dashboard ready",
        message: "Seed plan, Kanban, and activity timeline prepared.",
        metadataJson: JSON.stringify({ goalId }),
        createdAt: now(),
      },
      {
        id: randomUUID(),
        phase: "plan",
        source: "dashboard",
        status: "done",
        task: "skill-patterns",
        title: "Planning patterns applied",
        message:
          "Cards include dependency, acceptance criteria, size, and verification fields.",
        metadataJson: JSON.stringify({ source: "find-skills scan" }),
        createdAt: now(),
      },
    ])
    .run();

  db.insert(agentCheckpoints)
    .values({
      id: randomUUID(),
      agent: "codex",
      task: "bootstrap",
      status: "idle",
      summary: "대시보드는 관측판이고 작업 진행은 $codex-dashboard skill이 기록한다.",
      payloadJson: "{}",
      createdAt: now(),
    })
    .run();

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

  db.insert(harnessProfiles)
    .values({
      id: "harness-monitoring",
      name: "Codex Dashboard Monitoring",
      description:
        "Repo-local skill 기반 모니터링. 전역 설정과 MCP sidecar를 요구하지 않는다.",
      skillsJson: JSON.stringify(["codex-dashboard"]),
      mcpJson: JSON.stringify({}),
      instructions:
        "Use $codex-dashboard before project work, keep the dashboard open, record phase-level activity, and avoid private reasoning in logs.",
      status: "active",
      updatedAt: now(),
    })
    .run();

  db.insert(subagents)
    .values([
      {
        id: "agent-reviewer",
        name: "dashboard-reviewer",
        description: "계획/코드/위험을 독립 검토하는 reviewer subagent 후보.",
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
        description: "명령 범위 안에서 기능 구현을 맡는 implementer subagent 후보.",
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

  db.insert(settings)
    .values([
      { key: "schema_version", value: "monitoring-v1", updatedAt: now() },
      { key: "dashboard_url", value: "http://127.0.0.1:3000", updatedAt: now() },
      { key: "launcher_status", value: "manual", updatedAt: now() },
      { key: "app_id", value: "codex-dashboard", updatedAt: now() },
    ])
    .run();
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
    activities: getDb()
      .select()
      .from(activityEntries)
      .orderBy(desc(activityEntries.createdAt))
      .all(),
  };
}
