<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing code when framework behavior is unclear.
<!-- END:nextjs-agent-rules -->

# Vibe with Dashboard

Local, single-user monitoring dashboard for LLM agent work.

## Operating Rules

- Use `$vibe-with-dashboard` when the user wants project work reflected in the dashboard.
- Before monitored work, run `vibe-with-dashboard ensure`; do not ask the user to start the server manually.
- Keep the web app monitoring-only: no prompt input or agent command queue.
- Record phase-level activity with `vibe-with-dashboard activity`.
- Use `vibe-with-dashboard plan --plan-json "{...}"` for real work plans so milestones/cards are preserved. Use `--task` only for tiny work.
- Use `vibe-with-dashboard snapshot` before choosing the next Work Card.
- Use `vibe-with-dashboard card --card "..." --status doing|review|done` or activity card flags to keep Kanban current.
- Include agent-generated `translations` for Plan/Kanban titles and summaries when the user's locale is known.
- Use `vibe-with-dashboard suggest --suggestion-json "{...}"` to populate Rubber Duck suggestions for the active board.
- Boards archive automatically after all cards are done and result activity is recorded. Use `vibe-with-dashboard archive` only as a manual retry.
- Do not store private reasoning, credentials, secrets, or long terminal dumps in activity entries.
- Bind local services to `127.0.0.1`.
- Do not edit global agent settings unless the user explicitly requests `--global`.

## Dev Commands

- `npm run dashboard:ensure`: ensure dashboard is running, handle port conflicts, open browser.
- `npm run dashboard`: start the dashboard launcher.
- `npm run dashboard:activity -- --phase verify --message "..."`
- `npm run dashboard:plan -- --task "..."`
- `npm run dashboard:snapshot`
- `npm run dashboard:card -- --card "..." --status done`
- `npm run dashboard:archive`
- `npm run verify`: lint, typecheck, and unit tests.
- `npm run build`: Next production build.
- `npm run e2e`: Playwright smoke test.

## Architecture

- Next.js App Router UI with collapsible/resizable Plan sidebar, vertical Kanban, current processing rail, Activity sheet, and folded Inspector.
- Browser-locale i18n shell: English default, Korean supported, unsupported locales fall back to English.
- Floating Rubber Duck suggestions are agent-written, board-scoped, and archived with the board.
- Dashboard launcher uses production `next start` by default; set `VIBE_DASHBOARD_DEV=1` for dashboard development.
- SQLite/Drizzle state in the target project `.dashboard/dashboard.sqlite`.
- SSE stream at `/api/events/stream`.
- Activity reporting at `/api/agent/activity`.
- Plan reporting at `/api/agent/plan`.
- Archive endpoint at `/api/dashboard/archive`.
- Canonical skill at `skills/vibe-with-dashboard/`, repo-local mirror at `.agents/skills/vibe-with-dashboard/`.
