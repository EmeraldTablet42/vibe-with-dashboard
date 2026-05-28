# My Project Dashboard

## Mission

This repo is a local monitoring dashboard for Codex-assisted project work.

The dashboard is not a command queue. Codex work starts in the Codex session. The web app shows current plan, vertical Kanban, activity timeline, repo/GitHub status, design tokens, harness files, skills, MCP config, and subagents.

## Skill Contract

Use repo-local skill:

```text
$codex-dashboard <user task>
```

The skill must:

1. Run `npm run dashboard:ensure`.
2. Reuse an existing healthy dashboard for this repo.
3. If the default port is occupied by another app, pick the next available port without killing that app.
4. Open the dashboard URL in the user's default browser.
5. Record phase-level activity while doing the requested work.

## Activity Phases

- `start`: task accepted and dashboard ready.
- `plan`: context gathered and path chosen.
- `implement`: meaningful project changes made.
- `verify`: validation started or completed.
- `result`: task completed.
- `fail`: blocked or failed verification.

Never store private reasoning, secrets, credentials, or long terminal dumps in dashboard activity.

## Commands

```powershell
npm run dashboard:ensure
npm run dashboard
npm run dashboard:activity -- --phase implement --title "구현" --message "핵심 변경 완료"
npm run verify
npm run build
npm run e2e
```

## Interfaces

- Dashboard: `GET /api/dashboard/snapshot`
- Health: `GET /api/health`
- Agent activity: `POST /api/agent/activity`
- Limited plan edits: `PATCH /api/goals/:id`, `PATCH /api/milestones/:id`, `PATCH /api/cards/:id`

No MCP sidecar, heartbeat loop, Run queue, Decision queue, or dashboard prompt input is required.
