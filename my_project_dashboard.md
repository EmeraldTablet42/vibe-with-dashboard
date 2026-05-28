# My Project Dashboard Goal

## Codex Goal Mode Contract

This file is the goal document for Codex Goal mode. When the user starts Goal mode with `my_project_dashboard.md`, the active Codex session must become the long-running operator for the local project dashboard.

The goal is not complete when the dashboard merely starts. The goal is complete only after the dashboard sends a shutdown signal and Codex has safely stopped the loop.

## Mission

Operate a local, single-user, Codex-first project dashboard that keeps planning, Runs, milestones, Kanban, Git/GitHub, design tokens, harness settings, and subagents in one real-time cockpit.

## Completion Condition

Do not mark this Goal complete until all conditions are true:

1. Dashboard shutdown has been requested through the dashboard UI or MCP `check_shutdown` returns `shutdownRequested: true`.
2. No active Run is being executed, or the active Run has been completed/cancelled at a safe stopping point.
3. Final progress has been reported to the dashboard.
4. The heartbeat loop has stopped intentionally.

Idle state is not completion. If there is no Run, keep the Goal alive with adaptive heartbeat.

## Bootstrap

First action in Goal mode:

```powershell
npm run goal:bootstrap
```

Never ask the user to start `npm run dashboard` manually. Bootstrap owns dependency check, project config copy, dashboard launcher start, and readiness wait.

After bootstrap:

1. Ensure dashboard is reachable at `http://127.0.0.1:3000`.
2. Ensure dashboard MCP is reachable as server `dashboard` at `http://127.0.0.1:3333/mcp`.
3. Use the `project-dashboard-agent` skill.
4. Start the dashboard heartbeat loop.

## Runtime Loop

Repeat until shutdown:

1. Call `heartbeat`.
2. Call `check_shutdown`.
3. If shutdown is requested, stop claiming new Runs and perform graceful shutdown.
4. Call `poll_next_run`.
5. If a Run exists, execute only that Run scope.
6. Report progress with `report_progress` before and after meaningful phases.
7. Use `request_decision` for commits, pushes, destructive changes, external-cost actions, or ambiguous product decisions.
8. Finish the claimed Run with `complete_run`.
9. If no Run exists, remain idle and keep heartbeat alive.

## MCP Contract

MCP endpoint: `http://127.0.0.1:3333/mcp`

Tools:

- `heartbeat`
- `get_session_context`
- `poll_next_run`
- `report_progress`
- `request_decision`
- `complete_run`
- `sync_plan_update`
- `check_shutdown`

## Boundaries

- Do not change global Codex or Claude config.
- Use project-local `.codex/`, `.agents/`, `AGENTS.md`, and this file for harness control.
- Use GitHub through local `gh` auth.
- Keep UI state in SQLite, not Markdown.
- Preserve full structured Run/Event/Decision history.
- Do not end the Codex Goal just because the dashboard is idle.
