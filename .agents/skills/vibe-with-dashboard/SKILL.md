---
name: vibe-with-dashboard
description: Prepare and use the Vibe with Dashboard local monitoring app while doing project work. Use when the user invokes "$vibe-with-dashboard", asks to keep plan/Kanban/progress visible, or wants an LLM agent to record start/plan/implement/verify/result/fail activity in the dashboard.
---

# Vibe with Dashboard

Use this skill before doing the user's requested project work when monitoring is desired.

## Start

1. If `.agents/skills/vibe-with-dashboard/bin/vibe-with-dashboard.js` is missing, run:
   `npx -y github:EmeraldTablet42/vibe-with-dashboard`
2. Use the project-local CLI:
   `node .agents/skills/vibe-with-dashboard/bin/vibe-with-dashboard.js ensure`
   If `vibe-with-dashboard` is globally available, `vibe-with-dashboard ensure` is also fine.
3. Read the printed `DASHBOARD_URL=...`.
4. Tell the user the dashboard URL in one short sentence.
5. Create or replace the active board with the real working plan. Prefer detailed `--plan-json` when you already have a Codex/agent plan, so milestones and cards are not collapsed:
   `node .agents/skills/vibe-with-dashboard/bin/vibe-with-dashboard.js plan --plan-json "{\"task\":\"Implement onboarding\",\"title\":\"Onboarding\",\"summary\":\"Ship the first monitored flow\",\"milestones\":[{\"title\":\"UI\",\"cards\":[{\"title\":\"Create screen\",\"summary\":\"Render the active board\",\"status\":\"ready\",\"priority\":\"high\"}]}]}"`
   When the user's locale is known, include agent-generated translations for Plan/Kanban item text. Always include the user's native locale and `en`.
   If your Plan Mode emits `<proposed_plan>`, convert that plan into `--plan-json` before implementation. Do not summarize it away.
6. Add 3-5 Rubber Duck suggestions when useful, or explicitly clear suggestions when no advice is useful:
   `node .agents/skills/vibe-with-dashboard/bin/vibe-with-dashboard.js suggest --suggestion-json "{\"keyword\":\"Tests\",\"title\":\"Add coverage\",\"actionPrompt\":\"Add tests for the current change.\"}"`
   `node .agents/skills/vibe-with-dashboard/bin/vibe-with-dashboard.js suggest --clear`
7. Record start:
   `node .agents/skills/vibe-with-dashboard/bin/vibe-with-dashboard.js activity --phase start --title "Work started" --message "<user task summary>" --task "<short-task-id>"`

`ensure` owns dependency check, port selection, server start/reuse, state writing, and default browser opening. Do not ask the user to start the server manually.
The installed skill folder is the runtime root. All dashboard code, scripts, package files, and public assets needed to run the app live under `.agents/skills/vibe-with-dashboard`.
Dependencies are checked inside that skill root; compatible installs are reused, and missing or stale installs are repaired there without touching the target project's own dependencies.

The launcher uses `next dev` by default so dashboard UI changes appear immediately. The app hides the Next.js on-screen dev indicator; use `VIBE_DASHBOARD_PROD=1` only for explicit production smoke checks.

Progress updates must never be implemented by editing dashboard source code. For normal project work, update the dashboard only through the CLI/API path: CLI command -> REST API -> SQLite -> SSE -> React re-render.

## Plan Mode Import Contract

When a coding agent has a `<proposed_plan>`:

- Plan title becomes the board and goal title.
- Major sections become milestones.
- Execution bullets become cards.
- Test or verification bullets become verification cards.
- Assumptions become low-priority reference cards or milestone summary text.
- No major execution item, test item, or assumption may be dropped.
- Do not create visible Work Cards for dashboard bookkeeping such as "import this plan", "convert proposed_plan", or "sync dashboard"; that contract is metadata, not project work.
- Include `translations` for the user's locale and `en` on board/goal/milestone/card text when the user's locale is known.
- Treat the dashboard snapshot as the next working instruction source after import.

## Work Loop

Use the dashboard as the working milestone reference, not just a log. Check it when choosing the next unit:

`node .agents/skills/vibe-with-dashboard/bin/vibe-with-dashboard.js snapshot`

For every work unit, move the Kanban card before and after the work:

1. Before changing files or running a meaningful unit, move exactly one relevant Work Card to `doing`.
2. When that unit finishes, move that same card to `done` if complete or `review` if it needs human review.
3. Do not leave multiple cards in `doing` unless the user explicitly asked for parallel work.
4. If no existing card matches the unit, add or update the Plan first instead of working invisibly.

Record phase-level updates while doing the actual task:

- `plan`: after reading enough context and choosing the implementation path.
- `implement`: after meaningful code or file changes.
- `verify`: before and after running validation.
- `result`: when the request is completed.
- `fail`: when blocked or verification fails.

Update the relevant Work Card whenever a unit starts or completes:

```bash
vibe-with-dashboard activity --phase implement --title "UI started" --message "Editing dashboard shell" --card "Dashboard shell" --card-status doing
vibe-with-dashboard activity --phase verify --title "UI verified" --message "Shell tests passed" --card "Dashboard shell" --card-status done
```

Use concise dashboard messages. Do not store private reasoning, long terminal dumps, secrets, credentials, or other sensitive values.

## Board Lifecycle

- The dashboard is monitoring-only: no prompt input or agent command queue.
- Keep Plan and Kanban focused on the active task.
- The UI shell detects browser locale. Translate Plan/Kanban titles and summaries yourself when a non-English locale is expected; the dashboard only selects stored translations.
- For localized users, write both native-locale and `en` translations. The UI shows native text by default and lets the user switch content to English.
- Rubber Duck suggestions are also agent-written. Translate their keyword, title, summary, detail, and action prompt when a non-English locale is expected.
- When all cards are done and result activity is recorded, the dashboard archives the board and clears the Active Board automatically. Use `vibe-with-dashboard archive` only as a manual retry.

## Primary Commands

```bash
vibe-with-dashboard ensure
vibe-with-dashboard plan --plan-json '{"task":"Implement auth flow","title":"Auth flow","milestones":[{"title":"UI","cards":[{"title":"Build form","status":"ready","priority":"high"}]}]}'
vibe-with-dashboard snapshot
vibe-with-dashboard card --card "Build form" --status doing
vibe-with-dashboard suggest --suggestion-json '{"keyword":"Tests","title":"Add coverage","actionPrompt":"Add tests for this change."}'
vibe-with-dashboard suggest --clear
vibe-with-dashboard smoke
vibe-with-dashboard activity --phase result --title "Done" --message "All cards complete"
```

Rubber Duck suggestion-json example:

```bash
vibe-with-dashboard suggest --suggestion-json '{"keyword":"Docs","title":"Tighten setup docs","summary":"Clarify the install path.","detail":"The README should show the shortest project-local install and verify flow.","actionPrompt":"Review README.md and INSTALL.md for any unclear setup steps.","priority":"medium"}'
```

Project-local fallback:

```bash
node .agents/skills/vibe-with-dashboard/bin/vibe-with-dashboard.js ensure
node .agents/skills/vibe-with-dashboard/bin/vibe-with-dashboard.js plan --plan-json "{\"task\":\"Implement auth flow\",\"title\":\"Auth flow\",\"milestones\":[{\"title\":\"UI\",\"cards\":[{\"title\":\"Build form\",\"status\":\"ready\",\"priority\":\"high\"}]}]}"
node .agents/skills/vibe-with-dashboard/bin/vibe-with-dashboard.js card --card "Build form" --status doing
node .agents/skills/vibe-with-dashboard/bin/vibe-with-dashboard.js activity --phase implement --message "Core files updated" --card "Build form" --card-status done
```

## Compatibility

The skill works with any LLM coding agent that can run local commands. Codex, Claude Code, Gemini CLI, Cursor, Windsurf, Cline, Copilot, and other agents can install it through this repository or the Skills CLI.

## Completion

Before final response:

1. Run verification commands appropriate to the task.
2. After CLI updates, run `vibe-with-dashboard smoke` when checking that the user's live dashboard shows the active focus card, Plan doing card, Kanban doing card, and Rubber Duck chips.
3. Record `result` if successful, or `fail` with the blocking reason.
4. Mention the dashboard URL and verification outcome.
