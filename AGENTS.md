<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing code when framework behavior is unclear.
<!-- END:nextjs-agent-rules -->

# Vibe with Dashboard

Local, single-user monitoring dashboard for LLM agent work.

## Operating Rules

- Use `$vibe-with-dashboard` when the user wants project work reflected in the dashboard.
- Before monitored work, run `vibe-with-dashboard ensure`; do not ask the user to start the server manually.
- Keep the web app monitoring-only: no prompt input, Run queue, Decision queue, heartbeat loop, or MCP sidecar.
- Record phase-level activity with `vibe-with-dashboard activity`.
- Use `vibe-with-dashboard plan --task "..."` to populate the active Plan/Kanban board.
- Use `vibe-with-dashboard archive` after all cards are done and result activity is recorded.
- Do not store private reasoning, credentials, secrets, or long terminal dumps in activity entries.
- Bind local services to `127.0.0.1`.
- Do not edit global agent settings unless the user explicitly requests `--global`.

## Dev Commands

- `npm run dashboard:ensure`: ensure dashboard is running, handle port conflicts, open browser.
- `npm run dashboard`: start the dashboard launcher.
- `npm run dashboard:activity -- --phase verify --message "..."`
- `npm run dashboard:plan -- --task "..."`
- `npm run dashboard:archive`
- `npm run verify`: lint, typecheck, and unit tests.
- `npm run build`: Next production build.
- `npm run e2e`: Playwright smoke test.

## Architecture

- Next.js App Router UI with collapsible/resizable Plan sidebar, vertical Kanban, current processing rail, Activity sheet, and folded Inspector.
- SQLite/Drizzle state in the target project `.dashboard/dashboard.sqlite`.
- SSE stream at `/api/events/stream`.
- Activity reporting at `/api/agent/activity`.
- Plan reporting at `/api/agent/plan`.
- Archive endpoint at `/api/dashboard/archive`.
- Canonical skill at `skills/vibe-with-dashboard/`, repo-local mirror at `.agents/skills/vibe-with-dashboard/`.
