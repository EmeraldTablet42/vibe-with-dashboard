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
5. Create or replace the active board with the real working plan. Prefer detailed `--plan-json` when you already have a Codex/agent plan, so milestones and cards are not collapsed:
   `node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js plan --plan-json "{\"task\":\"Implement onboarding\",\"title\":\"Onboarding\",\"summary\":\"Ship the first monitored flow\",\"milestones\":[{\"title\":\"UI\",\"cards\":[{\"title\":\"Create screen\",\"summary\":\"Render the active board\",\"status\":\"ready\",\"priority\":\"high\"}]}]}"`
   When the user's locale is known, include agent-generated translations for Plan/Kanban item text.
6. Add 3-5 Rubber Duck suggestions when useful:
   `node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js suggest --suggestion-json "{\"keyword\":\"Tests\",\"title\":\"Add coverage\",\"actionPrompt\":\"Add tests for the current change.\"}"`
7. Record start:
   `node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js activity --phase start --title "Work started" --message "<user task summary>" --task "<short-task-id>"`

`ensure` owns dependency check, port selection, server start/reuse, state writing, and default browser opening. Do not ask the user to start the server manually.

## Work Loop

Use the dashboard as the working milestone reference, not just a log. Check it when choosing the next unit:

`node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js snapshot`

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
- Rubber Duck suggestions are also agent-written. Translate their keyword, title, summary, detail, and action prompt when a non-English locale is expected.
- When all cards are done and result activity is recorded, the dashboard archives the board and clears the Active Board automatically. Use `vibe-with-dashboard archive` only as a manual retry.

## Primary Commands

```bash
vibe-with-dashboard ensure
vibe-with-dashboard plan --plan-json '{"task":"Implement auth flow","title":"Auth flow","milestones":[{"title":"UI","cards":[{"title":"Build form","status":"ready","priority":"high"}]}]}'
vibe-with-dashboard snapshot
vibe-with-dashboard card --card "Build form" --status doing
vibe-with-dashboard suggest --suggestion-json '{"keyword":"Tests","title":"Add coverage","actionPrompt":"Add tests for this change."}'
vibe-with-dashboard activity --phase result --title "Done" --message "All cards complete"
```

Rubber Duck suggestion-json example:

```bash
vibe-with-dashboard suggest --suggestion-json '{"keyword":"Docs","title":"Tighten setup docs","summary":"Clarify the install path.","detail":"The README should show the shortest project-local install and verify flow.","actionPrompt":"Review README.md and INSTALL.md for any unclear setup steps.","priority":"medium"}'
```

Project-local fallback:

```bash
node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js ensure
node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js plan --plan-json "{\"task\":\"Implement auth flow\",\"title\":\"Auth flow\",\"milestones\":[{\"title\":\"UI\",\"cards\":[{\"title\":\"Build form\",\"status\":\"ready\",\"priority\":\"high\"}]}]}"
node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js card --card "Build form" --status doing
node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js activity --phase implement --message "Core files updated" --card "Build form" --card-status done
```

## Compatibility

The skill works with any LLM coding agent that can run local commands. Codex, Claude Code, Gemini CLI, Cursor, Windsurf, Cline, Copilot, and other agents can install it through this repository or the Skills CLI.

## Completion

Before final response:

1. Run verification commands appropriate to the task.
2. Record `result` if successful, or `fail` with the blocking reason.
3. Mention the dashboard URL and verification outcome.
