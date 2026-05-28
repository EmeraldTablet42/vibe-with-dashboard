<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# My Project Dashboard

This repo is a local, single-user, agent-driven dashboard for Codex work.

## Operating Rules

- Keep the app local-first. Bind dashboard and MCP services to `127.0.0.1`.
- Do not edit global Codex or Claude settings. Use project-local `.codex/`, `.agents/`, and repo files only.
- Treat the dashboard as the control plane. Most file/code changes should be represented as a `Run` and executed by Codex, not by arbitrary dashboard shell commands.
- Use risk-gated approvals: reads/tests are free, scoped edits are allowed by the Run, commits/pushes/deletes/external-cost actions require a decision.
- Store progress as structured events. Do not persist private chain-of-thought or raw terminal dumps.

## Dev Commands

- `npm run dashboard`: start custom launcher, Next app, and MCP sidecar.
- `npm run dev`: start only the Next app on `127.0.0.1:3000`.
- `npm run mcp`: start only dashboard MCP on `127.0.0.1:3333/mcp`.
- `npm run verify`: lint, typecheck, and unit tests.

## Architecture

- Next.js App Router UI with Korean 3-pane cockpit.
- SQLite/Drizzle state in `.dashboard/dashboard.sqlite`.
- SSE stream at `/api/events/stream`.
- Streamable HTTP MCP sidecar at `http://127.0.0.1:3333/mcp`.
- Repo skill at `.agents/skills/project-dashboard-agent/`.
