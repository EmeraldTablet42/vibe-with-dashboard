# Vibe with Dashboard Workflow

Use the dashboard as the visible monitor for agent work. The web app is monitoring-only: no prompt input, no command queue, no in-app LLM.

## Plan Import

Use `plan --plan-json` for real work. Preserve milestones, implementation cards, verification cards, assumptions, translations, priorities, and summaries. If a `<proposed_plan>` exists, convert it before implementation. Do not create visible cards for dashboard bookkeeping.

## Progress Contract

For each meaningful work unit:

1. Run `snapshot`.
2. Set exactly one matching Work Card to `doing`.
3. Perform the work.
4. Set that same card to `done` or `review`.
5. Record phase activity: `start`, `plan`, `implement`, `verify`, `result`, or `fail`.
6. Seed Rubber Duck suggestions or clear them.

Progress transport is CLI -> REST API -> SQLite -> SSE -> React.

## Rubber Duck

Suggestions are agent-written, board-scoped, and archived with the board. Seed 3-5 useful suggestions at a new board or major checkpoint, or run `suggest --clear` when no advice is useful.

## Localization

When the user's locale is known, include translations for the user's locale and `en` on Plan/Kanban items and Rubber Duck suggestions.
