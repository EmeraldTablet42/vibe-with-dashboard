---
name: project-dashboard-agent
description: Operate the local My Project Dashboard Codex loop through the dashboard MCP. Use when Codex is asked to connect to this repo's dashboard, poll Runs, report progress, request decisions, manage adaptive heartbeat, or stop gracefully from the dashboard shutdown signal.
---

# Project Dashboard Agent

Use this skill as the run-loop operator for the local dashboard.

## Start

1. Read `my_project_dashboard.md`.
2. If the dashboard or MCP is unavailable, run `npm run goal:bootstrap`. Do not ask the user to start the server manually.
3. Confirm the dashboard MCP is configured as `dashboard` at `http://127.0.0.1:3333/mcp`.
4. Call `heartbeat`.
5. Call `get_session_context`.
6. Call `poll_next_run`.

## Goal Mode

When this skill is used from Codex Goal mode with `my_project_dashboard.md`:

- Treat dashboard shutdown as the only normal completion condition.
- Do not mark the Goal complete while the dashboard is merely idle.
- Keep heartbeat alive between Runs.
- If MCP tools are temporarily unavailable, run `npm run goal:bootstrap`, then retry connection before reporting blocked.
- On shutdown, complete/cancel any active Run at a safe point, report final progress, then allow Goal completion.

## Loop

When `poll_next_run` returns a Run:

1. Restate the Run scope briefly.
2. Use `report_progress` before and after meaningful phases.
3. Execute only the active Run scope.
4. Use `request_decision` for commits, pushes, destructive changes, external-cost actions, or ambiguous product decisions.
5. Use `complete_run` with a concise result when finished.
6. Call `check_shutdown`.

When no Run exists:

- Call `heartbeat`.
- Stay idle until the next dashboard prompt, automation wakeup, or user message.
- Do not invent work unless a Run or explicit user message asks for it.
- Do not finish the Goal while idle.

## Shutdown

If `shutdownRequested` is true:

1. Stop claiming new Runs.
2. Bring any active Run to a safe stopping point.
3. Report final progress.
4. Complete or cancel the active Run with the real state.
5. Tell the user dashboard shutdown was honored.

## Boundaries

- Do not edit global Codex or Claude settings.
- Use project-local `.codex/`, `.agents/`, `AGENTS.md`, and repo files only.
- Do not store private reasoning in events.
- Prefer structured summaries over raw terminal output.
- Keep risk-gated approvals: reads/tests free, scoped edits allowed, commits/pushes/deletes/external-cost actions require a Decision.

## Reference

Read `references/mcp-contract.md` when tool inputs/outputs are unclear.
