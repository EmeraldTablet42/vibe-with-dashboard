# Codex Project Dashboard

Local-first project control plane for Codex Goal mode.

This dashboard keeps project planning, Runs, progress events, decisions, Kanban, repo state, design tokens, project-local Codex harness settings, MCP config, and subagents in one real-time cockpit. The intended workflow is simple: start Codex in Goal mode with `my_project_dashboard.md`, then use the dashboard UI to send work to the active Codex session.

## English

### What This Is

Codex Project Dashboard is a single-user local web app for agent-driven development. It runs a Next.js dashboard and a Streamable HTTP MCP sidecar on localhost. Codex connects to the MCP server, sends heartbeats, polls queued Runs, reports structured progress, asks for decisions, and stops only after dashboard shutdown.

### Core Flow

1. Start Codex Goal mode with `my_project_dashboard.md`.
2. Codex runs `npm run goal:bootstrap` if the dashboard is not already ready.
3. The dashboard starts at `http://127.0.0.1:3000`.
4. The MCP sidecar starts at `http://127.0.0.1:3333/mcp`.
5. The dashboard creates Runs from user prompts.
6. Codex claims Runs through MCP, executes them, reports progress, and waits for the next Run.
7. The Goal stays alive while idle.
8. The Goal completes only after dashboard shutdown is requested and Codex has safely stopped.

### Main Features

- Plan and Kanban dashboard with vertical workflow rows and priority columns.
- Live Session panel for Run prompts, Run mode cards, Decisions, Runs, and Events.
- Collapsible Inspector for Repo, GitHub, Design, Harness, and Subagents.
- SQLite event log and structured project state.
- Project-local Codex skill at `.agents/skills/project-dashboard-agent`.
- Project-local MCP config in `.codex/config.example.toml`.
- Streamable HTTP MCP tools for heartbeat, context, polling, progress, decisions, completion, plan sync, and shutdown.

### Commands

```powershell
npm run goal:bootstrap
npm run dashboard
npm run verify
npm run build
npm run e2e
```

`npm run goal:bootstrap` is the Goal-mode bootstrap command. It checks dependencies, prepares project-local Codex config, starts the dashboard launcher if needed, and waits until both dashboard and MCP are ready.

## 한국어

### 이 프로젝트

Codex Project Dashboard는 Codex Goal mode와 함께 쓰는 로컬 1인용 개발 대시보드입니다. 사용자는 웹 대시보드에서 계획, Run, 승인, Kanban, GitHub, 디자인 토큰, harness, subagent를 관리하고, 실제 작업은 연결된 Codex 세션이 처리합니다.

### 기본 흐름

1. Codex에서 Goal mode로 `my_project_dashboard.md`를 실행합니다.
2. Codex가 dashboard/MCP 준비 상태를 확인하고 필요하면 `npm run goal:bootstrap`을 실행합니다.
3. 사용자는 `http://127.0.0.1:3000` 대시보드에서 작업을 입력합니다.
4. 작업은 Run으로 저장됩니다.
5. Codex는 MCP를 통해 Run을 가져가고 진행 상황을 이벤트로 보고합니다.
6. 위험 작업은 Decision Queue에서 승인받습니다.
7. Run이 없으면 Goal은 idle heartbeat 상태로 계속 살아 있습니다.
8. 대시보드 종료 요청이 들어오면 Codex가 안전 지점에서 정리하고 Goal을 완료합니다.

### 화면 구성

- `Plan / Kanban`: 실행 단계와 우선순위 기준으로 카드 관리.
- `Live Session`: Codex로 보낼 Run 작성, mode 카드 선택, Decision/Run/Event 확인.
- `Inspector`: 접이식 패널. Repo, GitHub, Design, Harness, Agents 관리.
- `Harness`: 현재 repo의 Skills와 MCP 설정 확인 및 점검 Run 생성.

## LLM Operator Guide

Use this section when an LLM agent opens the repository.

### First Files To Read

1. `my_project_dashboard.md`
2. `.agents/skills/project-dashboard-agent/SKILL.md`
3. `AGENTS.md`
4. `.agents/skills/project-dashboard-agent/references/mcp-contract.md`

### Goal Mode Rules

- Treat `my_project_dashboard.md` as the active Goal document.
- Do not mark the Goal complete just because the dashboard is idle.
- The normal completion condition is dashboard shutdown.
- If dashboard or MCP is unavailable, run:

```powershell
npm run goal:bootstrap
```

- Use dashboard MCP tools instead of inventing a separate control loop.
- Report meaningful work through `report_progress`.
- Use `request_decision` before commits, pushes, destructive changes, external-cost actions, or ambiguous product decisions.

### MCP Endpoint

```text
http://127.0.0.1:3333/mcp
```

Expected tools:

- `heartbeat`
- `get_session_context`
- `poll_next_run`
- `report_progress`
- `request_decision`
- `complete_run`
- `sync_plan_update`
- `check_shutdown`

### Safety Boundaries

- Do not edit global Codex or Claude settings.
- Use project-local `.codex/`, `.agents/`, `AGENTS.md`, and repo files only.
- Do not store private reasoning in dashboard events.
- Reads and tests are free.
- Scoped file edits are allowed when the active Run asks for them.
- Commits, pushes, deletes, external repo creation, and paid/external actions require a dashboard Decision.

### Development Verification

Before publishing or pushing meaningful code changes, run:

```powershell
npm run verify
npm run build
```

Run Playwright when UI behavior changed:

```powershell
npm run e2e
```
