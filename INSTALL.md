# Install Vibe with Dashboard

One install. Works project-local first, with optional global skill copies and per-agent Skills CLI installs.

If you just want it to work, run the one-liner. If you want to see what gets touched, read the matrix and flags below.

## One-Liner

macOS / Linux / WSL / Git Bash:

```bash
curl -fsSL https://raw.githubusercontent.com/EmeraldTablet42/vibe-with-dashboard/main/install.sh | bash
```

Windows PowerShell 5.1+:

```powershell
irm https://raw.githubusercontent.com/EmeraldTablet42/vibe-with-dashboard/main/install.ps1 | iex
```

No shell pipe:

```bash
npx -y github:EmeraldTablet42/vibe-with-dashboard
```

What it does:

- Installs the Agent Skills folder into `.agents/skills/vibe-with-dashboard`.
- Uses `assets/dashboard-app` inside that skill folder as the dashboard app root, including the Next app, scripts, package files, tests, and public assets.
- Adds a small marker block to `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`.
- Leaves global agent settings alone unless `--global`, `--all`, or `--only <agent>` is passed.
- Skips unrelated services and never kills a process just because it owns port `3000`.
- Runs the dashboard in dev mode by default so code changes appear immediately. The Next.js on-screen dev indicator is hidden; use `VIBE_DASHBOARD_PROD=1` only when you explicitly want production mode.
- Starts the dashboard as a quiet background Node process on Windows and macOS so no extra terminal or console window pops up.

Preview without writing:

```bash
npx -y github:EmeraldTablet42/vibe-with-dashboard -- --dry-run
```

## Per-Agent Install

Every row also works as `--only <agent>` with the unified installer.

| Agent | Install command | Auto-start dashboard? |
| --- | --- | :-: |
| Codex CLI | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a codex -y` | Per task via `$vibe-with-dashboard` |
| Claude Code | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a claude -y` | Per task via `$vibe-with-dashboard` |
| Gemini CLI | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a gemini -y` | Per task via `$vibe-with-dashboard` |
| Cursor | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a cursor -y` | Per task |
| Windsurf | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a windsurf -y` | Per task |
| Cline | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a cline -y` | Per task |
| Roo Code | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a roo -y` | Per task |
| Kilo Code | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a kilo -y` | Per task |
| Continue | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a continue -y` | Per task |
| GitHub Copilot | `npx -y github:EmeraldTablet42/vibe-with-dashboard -- --only copilot` | Repo instructions |
| opencode | `npx -y github:EmeraldTablet42/vibe-with-dashboard -- --only opencode` | Repo instructions |
| Aider Desk | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a aider-desk -y` | Per task |
| Junie | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a junie -y` | Per task |
| Kiro CLI | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a kiro-cli -y` | Per task |
| Qwen Code | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a qwen-code -y` | Per task |
| OpenHands | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a openhands -y` | Per task |
| Goose | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a goose -y` | Per task |
| Augment Code | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a augment -y` | Per task |
| Sourcegraph Amp | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a amp -y` | Per task |
| Warp | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a warp -y` | Per task |
| Replit Agent | `npx -y skills add EmeraldTablet42/vibe-with-dashboard -a replit -y` | Per task |

Soft probe means the installer will not auto-detect the agent reliably. Use `--only <agent>` when you want that target.

## Manual Install

Clone and inspect first:

```bash
git clone https://github.com/EmeraldTablet42/vibe-with-dashboard.git
cd vibe-with-dashboard
node bin/vibe-with-dashboard.js install --dry-run
node bin/vibe-with-dashboard.js list
node bin/vibe-with-dashboard.js install
```

Useful flags:

| Flag | What |
| --- | --- |
| `--dry-run` | Print planned actions. Write nothing. |
| `--project <path>` | Install into another project directory. |
| `--global` | Also copy the skill into user-level skill folders. |
| `--all` | Run Skills CLI installs for every detected provider. |
| `--only <agent>` | Run Skills CLI install for one provider. Repeatable. |
| `--list` | Print the provider matrix and detection state. |
| `--force` | Reserved for future overwrite behavior. Current install is idempotent. |

## Verify

After install:

```bash
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js ensure
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js plan --plan-json "{\"task\":\"Verify dashboard install\",\"title\":\"Verify dashboard install\",\"milestones\":[{\"title\":\"Smoke\",\"cards\":[{\"title\":\"Open dashboard\",\"status\":\"ready\",\"priority\":\"high\"}]}]}"
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js plan --task "Verify dashboard install" --translations '{"ko":{"title":"대시보드 설치 확인","task":"대시보드 설치 확인"}}'
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js card --card "Open dashboard" --status doing
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js suggest --suggestion-json '{"keyword":"Verify","title":"Check the dashboard","actionPrompt":"Verify the Vibe with Dashboard install."}'
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js smoke
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js activity --phase result --message "Install verified" --card "Open dashboard" --card-status done
```

Rubber Duck suggestion-json example:

```bash
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js suggest --suggestion-json '{"keyword":"Docs","title":"Tighten setup docs","summary":"Clarify the install path.","detail":"The README should show the shortest project-local install and verify flow.","actionPrompt":"Review README.md and INSTALL.md for any unclear setup steps.","priority":"medium"}'
```

Expected:

- Browser opens `http://127.0.0.1:<port>`.
- `/api/health` returns `appId: "vibe-with-dashboard"`.
- Plan sidebar shows the task.
- Kanban shows at least one card.
- Card status changes appear without reloading the dashboard.
- Completed boards archive automatically after result activity when every card is done.
- If the browser locale is Korean and the agent supplied Korean plus English translations, Plan/Kanban items use Korean by default and can be toggled to English.
- Rubber Duck appears at the bottom-right and can show agent-written suggestion keywords.
- `smoke` confirms the live URL, active focus card, one Plan `doing` card, one Kanban `doing` card, and Rubber Duck chips after CLI updates.
- Activity sheet shows the result entry.

Progress is data-driven: agent CLI commands call local API endpoints, the dashboard stores state in SQLite, and the browser refreshes through SSE. Agents should not edit dashboard source code just to move progress.

## Uninstall

Project-local files:

```bash
rm -rf .dashboard .agents/skills/vibe-with-dashboard .vibe-with-dashboard
```

Windows PowerShell:

```powershell
Remove-Item -Recurse -Force .dashboard, .agents\skills\vibe-with-dashboard, .vibe-with-dashboard
```

The installer marker blocks in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` are fenced with:

```text
<!-- vibe-with-dashboard:start -->
<!-- vibe-with-dashboard:end -->
```

Remove those blocks if you want the project completely clean.

Skills installed through `npx skills add` are owned by the Skills CLI or the host agent. Remove them with that tool's normal remove/uninstall command.

## Troubleshooting

**Dashboard keeps choosing new ports.**

Run:

```bash
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js ensure
```

The launcher reuses the same dashboard when `/api/health` matches this project. If another app owns `3000`, it picks the next open port without killing that app.

**The skill exists but runtime files are missing.**

Run the repo installer once:

```bash
npx -y github:EmeraldTablet42/vibe-with-dashboard
```

**Agent cannot find `vibe-with-dashboard`.**

Use the project-local command:

```bash
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js ensure
```

**Install touched files I care about.**

The marker blocks are idempotent and fenced. Delete only the fenced block, not the whole file.

## Privacy

The installer writes local files only. It has no telemetry and no analytics.

Network calls can happen through the commands you choose to run: GitHub URL install through `npx`, Skills CLI installs, `npm ci` or `npm install` inside `.agents/skills/vibe-with-dashboard`, and any agent-specific package manager used by your environment.
