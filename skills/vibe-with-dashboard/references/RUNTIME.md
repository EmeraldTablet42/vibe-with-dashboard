# Runtime Layout

Skill root:

```text
vibe-with-dashboard/
├── SKILL.md
├── scripts/
├── references/
├── assets/
│   ├── dashboard-app/
│   └── rubber-duck/
└── agents/openai.yaml
```

Root meanings:

- `skillRoot`: installed skill folder.
- `appRoot`: `skillRoot/assets/dashboard-app`.
- `projectRoot`: target repo or worktree where the agent is working.

The dashboard server runs from `appRoot`. Dependency checks run in `appRoot` and may install `appRoot/node_modules`. All target state goes to `projectRoot/.dashboard/`: SQLite, launcher state, logs, smoke state, and sample artifacts.

Normal startup must be quiet. Windows prefers `nodew.exe`; if unavailable, the launcher uses a hidden `Win32_ProcessStartup.ShowWindow = 0` wrapper with stdout/stderr redirected to `.dashboard` logs. macOS/Linux use detached child processes with redirected or ignored stdio.
