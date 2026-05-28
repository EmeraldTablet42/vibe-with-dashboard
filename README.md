# Codex Project Dashboard

Local-first monitoring dashboard for Codex-assisted project work.

The dashboard shows plan, vertical Kanban, activity timeline, repo/GitHub state, design tokens, harness files, repo-local skills, MCP config, and subagent definitions. It no longer acts as a live session controller: no web prompt input, Run queue, Decision queue, heartbeat loop, or MCP sidecar.

## Basic Flow

Use the repo-local skill in a Codex request:

```text
$codex-dashboard <your task>
```

The skill runs `npm run dashboard:ensure`, checks whether the dashboard is already healthy, avoids port conflicts without killing other apps, opens the dashboard in the default browser, and records phase-level progress while Codex works.

## Commands

```powershell
npm run dashboard:ensure
npm run dashboard
npm run dashboard:activity -- --phase implement --title "구현" --message "핵심 변경 완료"
npm run verify
npm run build
npm run e2e
```

## 화면

- `Plan`: goal, milestone, card context.
- `Kanban`: vertical workflow rows, priority columns, current processing rail.
- `Activity`: header toggle sheet for `start`, `plan`, `implement`, `verify`, `result`, `fail` records.
- `Inspector`: 기본 접힘. Repo, GitHub, Design, Harness, Skills, MCP, Subagents snapshot.

## API

- `GET /api/health`
- `GET /api/dashboard/snapshot`
- `POST /api/agent/activity`
- `PATCH /api/goals/:id`
- `PATCH /api/milestones/:id`
- `PATCH /api/cards/:id`

## LLM Operator Guide

1. Read `my_project_dashboard.md`.
2. Use `.agents/skills/codex-dashboard/SKILL.md`.
3. Run `npm run dashboard:ensure`.
4. Record progress with `npm run dashboard:activity`.
5. Run task-specific verification before final response.

Never write private reasoning, secrets, credentials, or raw long logs into dashboard activity.
