---
name: vibe-with-dashboard
description: Prepare and use the Vibe with Dashboard local monitoring app while doing project work. Use when the user invokes "$vibe-with-dashboard", asks to keep plan/Kanban/progress visible, or wants an LLM agent to record start/plan/implement/verify/result/fail activity in the dashboard.
---

# Vibe with Dashboard

Use this skill before doing the user's requested project work when monitoring is desired.

## Start

1. If `.vibe-with-dashboard/app/bin/vibe-with-dashboard.js` is missing, run:
   `npx -y github:EmeraldTablet42/vibe-with-dashboard`
2. Use the project-local CLI:
   `node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js ensure`
   If `vibe-with-dashboard` is globally available, `vibe-with-dashboard ensure` is also fine.
3. Read the printed `DASHBOARD_URL=...`.
4. Tell the user the dashboard URL in one short sentence.
5. Create or update the active board:
   `node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js plan --task "<user task summary>"`
6. Record start:
   `node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js activity --phase start --title "Work started" --message "<user task summary>" --task "<short-task-id>"`

`ensure` owns dependency check, port selection, server start/reuse, state writing, and default browser opening. Do not ask the user to start the server manually.

## Work Loop

Record phase-level updates while doing the actual task:

- `plan`: after reading enough context and choosing the implementation path.
- `implement`: after meaningful code or file changes.
- `verify`: before and after running validation.
- `result`: when the request is completed.
- `fail`: when blocked or verification fails.

Use concise dashboard messages. Do not store private reasoning, long terminal dumps, secrets, credentials, or other sensitive values.

## Board Lifecycle

- The dashboard is monitoring-only: no prompt queue, Run queue, Decision queue, heartbeat loop, or MCP sidecar.
- Keep Plan and Kanban focused on the active task.
- When all cards are done and result activity is recorded, run `vibe-with-dashboard archive` to store the completed board and clear the active board.

## Primary Commands

```bash
vibe-with-dashboard ensure
vibe-with-dashboard plan --task "Implement auth flow"
vibe-with-dashboard activity --phase implement --title "Implementation" --message "Core files updated"
vibe-with-dashboard archive
```

Project-local fallback:

```bash
node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js ensure
node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js plan --task "Implement auth flow"
node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js activity --phase implement --message "Core files updated"
node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js archive
```

## Compatibility

The skill works with any LLM coding agent that can run local commands. Codex, Claude Code, Gemini CLI, Cursor, Windsurf, Cline, Copilot, and other agents can install it through this repository or the Skills CLI.

## Completion

Before final response:

1. Run verification commands appropriate to the task.
2. Record `result` if successful, or `fail` with the blocking reason.
3. Mention the dashboard URL and verification outcome.
