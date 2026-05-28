# Dashboard MCP Contract

Endpoint: `http://127.0.0.1:3333/mcp`

All tool responses are JSON in a text content item.

## Tools

- `heartbeat({ sessionId?, label?, currentRunId?, notes? })`
  - Updates Codex liveness.
  - Returns `shutdownRequested`, `heartbeatIntervalSeconds`, and pending work count.
- `get_session_context({})`
  - Returns active goals, open decisions, recent runs, settings, and launch metadata.
- `poll_next_run({ sessionId? })`
  - Claims oldest queued Run, marks it running, returns `{ run, shutdownRequested }`.
- `report_progress({ runId?, type?, severity?, title, message, payloadJson? })`
  - Appends structured Event.
- `request_decision({ runId?, title, body, options? })`
  - Creates Decision and moves Run to `waiting_approval`.
- `complete_run({ runId, status?, result })`
  - Ends Run as `completed`, `failed`, or `cancelled`.
- `sync_plan_update({ title, message, payloadJson? })`
  - Records planning changes as structured history.
- `check_shutdown({})`
  - Returns graceful shutdown flag.

## Event Rules

- Use short event titles.
- Put detailed machine-readable data in `payloadJson`.
- Never send private chain-of-thought.
- Prefer status events over raw terminal dumps.

