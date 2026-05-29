---
name: vibe-with-dashboard
description: Prepare and use the Vibe with Dashboard local monitoring app for LLM agent project work. Use when the user invokes "$vibe-with-dashboard", wants Plan/Kanban/activity progress visible, asks for monitored work, or needs agent-written Rubber Duck suggestions.
---

# Vibe with Dashboard

Use before monitored project work.

## Start

1. If `.agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js` is missing, run:
   `npx -y github:EmeraldTablet42/vibe-with-dashboard`
2. Ensure or reuse the project-local dashboard:
   `node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js ensure`
3. Read `DASHBOARD_URL=...` and tell the user the URL.
4. Import the real work plan with `plan --plan-json`. Use `--task` only for tiny one-card work.
5. Seed 3-5 useful Rubber Duck suggestions with `suggest --suggestion-json`, or explicitly clear them with `suggest --clear`.
6. Record `start` activity.

The skill root is `.agents/skills/vibe-with-dashboard`. The dashboard app runtime is under `assets/dashboard-app`. Dependencies are checked and installed only in `assets/dashboard-app/node_modules`. Target project state, logs, launcher state, smoke state, SQLite, and archives live only in the target repo/worktree `.dashboard/`.

## Work Loop

Before each meaningful work unit:

1. Run `snapshot`.
2. Move exactly one matching Work Card to `doing`.
3. Do the work.
4. Move that same card to `done` or `review`.
5. Record concise activity.
6. Refresh Rubber Duck suggestions or clear them.

Progress must flow through CLI -> REST API -> SQLite -> SSE -> React. Do not edit dashboard source code to show progress.

## Commands

```bash
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js ensure
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js plan --plan-json '{"task":"Implement onboarding","title":"Implement onboarding","milestones":[{"title":"UI","cards":[{"title":"Create screen","status":"ready","priority":"high"}]}]}'
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js snapshot
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js activity --phase implement --message "Core files updated" --card "Create screen" --card-status doing
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js suggest --suggestion-json '{"keyword":"Tests","title":"Add coverage","actionPrompt":"Add tests for this change."}'
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js smoke
```

## Details

- Workflow contract: `references/WORKFLOW.md`
- Optional Codex hooks: `references/CODEX_HOOKS.md`
- Runtime layout and install safety: `references/RUNTIME.md`

Before finishing, run suitable verification, run `smoke` when live dashboard state matters, and record `result` or `fail`.
