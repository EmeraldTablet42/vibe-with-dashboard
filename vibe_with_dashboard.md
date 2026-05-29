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
5. Run `vibe-with-dashboard plan --plan-json '{...}'` for real agent plans so milestones/cards are not collapsed. Simple `--task` remains available for tiny work.
6. Run `vibe-with-dashboard snapshot` before choosing the next work unit.
7. Run `vibe-with-dashboard suggest --suggestion-json '{...}'` with 3-5 useful Rubber Duck suggestions, or `vibe-with-dashboard suggest --clear` when no useful advice exists.
8. Record phase-level activity and card status updates while doing the requested work.
9. Run `vibe-with-dashboard smoke` after CLI updates when you need to confirm the user's live dashboard is showing the same state.
10. Completed boards archive automatically after all cards are `done` and `result` activity is recorded.

Progress updates are never source-code edits. They flow through CLI -> REST API -> SQLite -> SSE -> React re-render.
Agents must move the board as they work: before each meaningful work unit, exactly one matching Work Card should become `doing`; after the unit, that card should become `done` or `review`. If no card matches, update the Plan before continuing. Rubber Duck suggestions are also agent-written; the agent should seed useful suggestions or explicitly clear them so the duck never looks broken because data was omitted.

Project-local installs use `.agents/skills/vibe-with-dashboard` as the Skill Root. The dashboard app runtime lives under `assets/dashboard-app`, with package files, the Next app, app scripts, tests, and public assets. Startup checks dependencies in `assets/dashboard-app` and reuses compatible `node_modules`; if dependencies are missing or stale, it installs them there rather than in the user project.

When Plan Mode emits `<proposed_plan>`, convert it to `plan --plan-json` before implementation. The title becomes board/goal, major sections become milestones, execution bullets become cards, test bullets become verification cards, and assumptions become low-priority reference cards or milestone summary. No major execution item, test item, or assumption should be dropped. Dashboard bookkeeping such as importing, converting, or syncing the plan is metadata and should not appear as a visible Work Card.

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
vibe-with-dashboard plan --plan-json '{"task":"Implement onboarding","title":"Implement onboarding","milestones":[{"title":"UI","cards":[{"title":"Create screen","summary":"Render the active board.","status":"ready","priority":"high"}]}]}'
vibe-with-dashboard plan --task "Implement onboarding" --translations '{"ko":{"title":"온보딩 구현","task":"온보딩 구현"}}'
vibe-with-dashboard snapshot
vibe-with-dashboard card --card "Create screen" --status doing
vibe-with-dashboard suggest --suggestion-json '{"keyword":"Tests","title":"Add coverage","actionPrompt":"Add tests for the current change."}'
vibe-with-dashboard smoke
vibe-with-dashboard activity --phase verify --title "Verification" --message "Core UI verified" --card "Create screen" --card-status done
vibe-with-dashboard activity --phase result --title "Done" --message "All cards complete"
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
- Agent card progress: `POST /api/agent/cards`
- Agent activity: `POST /api/agent/activity`
- Agent suggestions: `POST /api/agent/suggestions`
- Duck read state: `PATCH /api/duck-suggestions/:id`
- Archive: `POST /api/dashboard/archive`
- Limited plan edits: `PATCH /api/goals/:id`, `PATCH /api/milestones/:id`, `PATCH /api/cards/:id`

No dashboard prompt input or agent command queue is required.

## Locale

The UI shell detects `navigator.languages`, supports English and Korean, and falls back to English for unsupported shell languages. Plan/Kanban content uses the browser-native locale by default, then `en`, then source text. The header can switch content display to English. API data is stored as original agent text plus optional `translations` maps; the LLM agent is responsible for supplying translated Plan/Kanban titles and summaries.

Rubber Duck suggestions follow the same translation rule for keyword, title, summary, detail, and action prompt.

## Launcher

`vibe-with-dashboard ensure` starts the dashboard from `assets/dashboard-app` through `next dev` by default so monitored UI changes are visible immediately. Windows startup prefers `nodew.exe` and falls back to a hidden process wrapper; macOS/Linux use detached redirected child processes. Normal startup does not open an extra terminal or console window. The dashboard hides the Next.js on-screen dev indicator while leaving build/runtime errors available. Set `VIBE_DASHBOARD_PROD=1` only when intentionally running the dashboard in production mode.
