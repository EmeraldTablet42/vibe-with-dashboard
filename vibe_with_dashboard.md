# Vibe with Dashboard

## Mission

This repo ships an installable skill and local web dashboard for monitoring LLM agent project work.

The dashboard is not a command queue. Agent work starts in the agent session. The web app shows the active plan, vertical Kanban, current processing state, activity timeline, repo/GitHub status, design tokens, harness files, skills, MCP config, and subagents.

## Skill Contract

Use:

```text
$vibe-with-dashboard <user task>
```

The skill must:

1. Run `vibe-with-dashboard ensure`.
2. Reuse an existing healthy dashboard for this project.
3. If the default port is occupied by another app, pick the next available port without killing that app.
4. Open the dashboard URL in the user's default browser.
5. Run `vibe-with-dashboard plan --task "<summary>"`, including agent-generated Plan/Kanban translations when the user's locale is known.
6. Optionally run `vibe-with-dashboard suggest --suggestion-json '{...}'` with 3-5 agent-written Rubber Duck suggestions.
7. Record phase-level activity while doing the requested work.
8. Archive a completed board when all cards are done and result activity is recorded.

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
vibe-with-dashboard ensure
vibe-with-dashboard plan --task "Implement onboarding"
vibe-with-dashboard plan --task "Implement onboarding" --translations '{"ko":{"title":"온보딩 구현","task":"온보딩 구현"}}'
vibe-with-dashboard suggest --suggestion-json '{"keyword":"Tests","title":"Add coverage","actionPrompt":"Add tests for the current change."}'
vibe-with-dashboard activity --phase implement --title "Implementation" --message "Core UI updated"
vibe-with-dashboard archive
npm run verify
npm run build
npm run e2e
```

Rubber Duck suggestion-json example:

```powershell
vibe-with-dashboard suggest --suggestion-json '{"keyword":"Docs","title":"Tighten setup docs","summary":"Clarify the install path.","detail":"The README should show the shortest project-local install and verify flow.","actionPrompt":"Review README.md and INSTALL.md for any unclear setup steps.","priority":"medium"}'
```

## Interfaces

- Dashboard: `GET /api/dashboard/snapshot`
- Health: `GET /api/health`
- Agent plan: `POST /api/agent/plan`
- Agent activity: `POST /api/agent/activity`
- Agent suggestions: `POST /api/agent/suggestions`
- Duck read state: `PATCH /api/duck-suggestions/:id`
- Archive: `POST /api/dashboard/archive`
- Limited plan edits: `PATCH /api/goals/:id`, `PATCH /api/milestones/:id`, `PATCH /api/cards/:id`

No dashboard prompt input or agent command queue is required.

## Locale

The UI shell detects `navigator.languages`, supports English and Korean, and falls back to English for unsupported locales. API data is stored as original agent text plus optional `translations` maps; the LLM agent is responsible for supplying translated Plan/Kanban titles and summaries.

Rubber Duck suggestions follow the same translation rule for keyword, title, summary, detail, and action prompt.

## Launcher

`vibe-with-dashboard ensure` starts the dashboard through the production launcher by default. Set `VIBE_DASHBOARD_DEV=1` only when intentionally running the dashboard in development mode.
