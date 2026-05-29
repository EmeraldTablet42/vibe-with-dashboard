# Optional Codex Hooks

Hooks are an optional enhancement. The CLI workflow remains authoritative when hooks are unavailable, disabled, or untrusted.

Project-local hooks live under `.codex/hooks.json` or `.codex/config.toml`. Codex only loads project-local hooks after the project `.codex/` layer is trusted, and non-managed command hooks must be reviewed with `/hooks`.

Recommended lifecycle coverage:

- `SessionStart`: ensure dashboard, capture `projectRoot`, load snapshot.
- `UserPromptSubmit`: remind the agent to import a plan and seed or clear Rubber Duck suggestions.
- `PostToolUse`: detect meaningful work after shell, apply_patch, or MCP tools when no card/activity update followed.
- `Stop`: detect stale `doing`, missing `result` or `fail`, and missing live smoke after dashboard-facing changes.

Hook scripts should write concise JSON or context only. They must not store private reasoning, credentials, secrets, or long terminal dumps in dashboard activity.
