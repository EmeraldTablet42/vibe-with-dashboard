---
name: codex-dashboard
description: Prepare and use this repo's local Codex Dashboard monitoring app while doing project work. Use when the user invokes "$codex-dashboard", asks to keep the dashboard updated, wants project plan/Kanban/progress monitoring, or asks Codex to work while reflecting start/plan/implement/verify/result/fail activity in the dashboard.
---

# Codex Dashboard

Use this skill before doing the user's requested project work.

## Start

1. Run `npm run dashboard:ensure`.
2. Read the printed `DASHBOARD_URL=...`.
3. Tell the user the dashboard URL in one short sentence.
4. Record start:
   `npm run dashboard:activity -- --phase start --title "작업 시작" --message "<user task summary>" --task "<short-task-id>"`

`dashboard:ensure` owns dependency check, port selection, server start/reuse, state writing, and default browser opening. Do not ask the user to start the server manually.

## Work Loop

Record phase-level updates while doing the actual task:

- `plan`: after reading enough context and choosing the implementation path.
- `implement`: after meaningful code or file changes.
- `verify`: before and after running validation.
- `result`: when the request is completed.
- `fail`: when blocked or verification fails.

Use concise dashboard messages. Do not store private reasoning, long terminal dumps, secrets, or credentials.

## Dashboard Contract

The dashboard is monitoring-only:

- Do not create Runs from the web app.
- Do not use a heartbeat loop.
- Do not rely on MCP sidecar tools.
- Use REST/CLI activity reporting only.

Primary commands:

```powershell
npm run dashboard:ensure
npm run dashboard:activity -- --phase implement --title "구현" --message "핵심 변경 완료"
```

Primary API:

- `GET /api/health`
- `GET /api/dashboard/snapshot`
- `POST /api/agent/activity`

## Completion

Before final response:

1. Run the verification commands appropriate to the task.
2. Record `result` if successful, or `fail` with the blocking reason.
3. Mention the dashboard URL and verification outcome.
