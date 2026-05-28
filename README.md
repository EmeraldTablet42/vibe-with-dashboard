# Vibe with Dashboard

Local monitoring dashboard for LLM agent work.

Vibe with Dashboard keeps your project plan, Kanban board, current processing state, repo snapshot, skills, and agent activity visible while the actual work stays in your coding agent.

No prompt box. No agent command queue. Just a local display board for vibe coding, with a Rubber Duck for agent-written suggestions.

Install • Use • What You Get • Agent Support • [Full install guide](./INSTALL.md)

## Install

One line. Project-local by default.

```bash
npx -y github:EmeraldTablet42/vibe-with-dashboard
```

macOS / Linux / WSL:

```bash
curl -fsSL https://raw.githubusercontent.com/EmeraldTablet42/vibe-with-dashboard/main/install.sh | bash
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/EmeraldTablet42/vibe-with-dashboard/main/install.ps1 | iex
```

Skills CLI:

```bash
npx skills add EmeraldTablet42/vibe-with-dashboard
```

Global install is opt-in:

```bash
npx -y github:EmeraldTablet42/vibe-with-dashboard -- --global
```

Preview first:

```bash
npx -y github:EmeraldTablet42/vibe-with-dashboard -- --dry-run
```

## Use

In your agent session:

```text
$vibe-with-dashboard <your task>
```

The skill tells the agent to:

1. Run the project-local dashboard CLI.
2. Reuse or start the local dashboard.
3. Open the dashboard in your default browser.
4. Create/update the active plan board with full milestones and cards.
5. Use the dashboard snapshot as the working milestone reference.
6. Record `start`, `plan`, `implement`, `verify`, `result`, or `fail` activity.
7. Move Work Cards to `doing`, `review`, or `done` as task units change state.
8. Provide Plan/Kanban item translations for the user's native locale and `en` when the target locale is known.

Progress is data-driven, not code-driven: agents send CLI commands, the CLI calls the dashboard API, SQLite stores the new state, and SSE refreshes the open page. Normal work should never edit dashboard source code just to change progress.

Manual commands:

```bash
vibe-with-dashboard ensure
vibe-with-dashboard plan --plan-json '{"task":"Implement onboarding","title":"Implement onboarding","milestones":[{"title":"UI","cards":[{"title":"Create screen","summary":"Render the active board.","status":"ready","priority":"high"}]}]}'
vibe-with-dashboard plan --task "Implement onboarding" --translations '{"ko":{"title":"온보딩 구현","task":"온보딩 구현"}}'
vibe-with-dashboard snapshot
vibe-with-dashboard card --card "Create screen" --status doing
vibe-with-dashboard suggest --suggestion-json '{"keyword":"Tests","title":"Add coverage","actionPrompt":"Add tests for the current change."}'
vibe-with-dashboard activity --phase verify --message "Core UI verified" --card "Create screen" --card-status done
vibe-with-dashboard activity --phase result --message "All cards complete"
```

Rubber Duck suggestion-json example:

```bash
vibe-with-dashboard suggest --suggestion-json '{"keyword":"Docs","title":"Tighten setup docs","summary":"Clarify the install path.","detail":"The README should show the shortest project-local install and verify flow.","actionPrompt":"Review README.md and INSTALL.md for any unclear setup steps.","priority":"medium"}'
```

Project-local fallback, always available after the one-line install:

```bash
node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js ensure
node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js plan --plan-json "{\"task\":\"Implement onboarding\",\"title\":\"Implement onboarding\",\"milestones\":[{\"title\":\"UI\",\"cards\":[{\"title\":\"Create screen\",\"status\":\"ready\",\"priority\":\"high\"}]}]}"
node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js card --card "Create screen" --status doing
node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js activity --phase result --message "All cards complete" --card "Create screen" --card-status done
```

## What You Get

| Area | What it shows |
| --- | --- |
| Plan sidebar | Goal, milestones, cards. Collapsible and resizable. Reopens at default width. |
| Kanban | Vertical workflow rows and priority columns. Drag cards or let agents update cards. |
| Current state | Active phase, focus card, and progress rail. |
| Activity sheet | Agent activity timeline, hidden until toggled. |
| Inspector | Repo, GitHub, design tokens, harness files, skills, MCP, subagents. |
| Rubber Duck | Floating generated duck icon with unread suggestion badge, keyword chips, and copyable action prompts. |
| Archive | Finished boards are stored automatically after every card is done and result activity is recorded. |
| Locale | Browser-native Plan/Kanban content by default, with an English toggle. Unsupported shell languages fall back to English. |

## Agent Support

The installer has a provider matrix for Codex, Claude Code, Gemini CLI, Cursor, Windsurf, Cline, Roo, Kilo, Continue, GitHub Copilot, opencode, Aider-style agents, Junie, Kiro, Qwen Code, OpenHands, Goose, and more.

Default install writes project-local files only. `--global` writes user-level skill copies. `--all` or `--only <agent>` can additionally call the Skills CLI profile installer.

Useful flags:

```bash
vibe-with-dashboard install --dry-run
vibe-with-dashboard install --list
vibe-with-dashboard install --only codex
vibe-with-dashboard install --all --dry-run
```

Full matrix and flags live in [INSTALL.md](./INSTALL.md).

## How It Works

1. Installer copies the dashboard app into `.vibe-with-dashboard/app`.
2. Installer drops the skill into `.agents/skills/vibe-with-dashboard`.
3. The skill tells your agent to start or reuse the local dashboard.
4. The agent records task-level plan and activity events while it works.
5. The agent can write 3-5 Rubber Duck suggestions for the active board.
6. Completed boards can be archived, then the active board returns to empty.

When an agent has a `<proposed_plan>`, it should convert that plan into `plan --plan-json` before implementation. Plan title becomes board/goal, major sections become milestones, execution bullets become cards, test bullets become verification cards, and assumptions remain as low-priority reference cards or milestone summary. Do not drop major items. Do not add visible cards for dashboard bookkeeping such as importing or syncing the plan; that contract is metadata.

## Development

```bash
npm install
npm run dashboard:ensure
npm run verify
npm run build
npm run e2e
```

The launcher runs `next dev` by default so dashboard code changes show up immediately. Next's on-screen dev indicator is hidden; runtime/build errors still surface. Use `VIBE_DASHBOARD_PROD=1 npm run dashboard` when you explicitly want the production launcher.

The app binds to `127.0.0.1`, stores local state in `.dashboard/`, and keeps private reasoning, credentials, secrets, and long terminal dumps out of activity records.

## Links

- [INSTALL.md](./INSTALL.md) — full install matrix, flags, verify, uninstall, troubleshooting
- [vibe_with_dashboard.md](./vibe_with_dashboard.md) — mission and dashboard contract
- [skills/vibe-with-dashboard](./skills/vibe-with-dashboard/SKILL.md) — canonical skill
- [Issues](https://github.com/EmeraldTablet42/vibe-with-dashboard/issues) — bugs and requests
