# Vibe with Dashboard Recursive Reliability Goal

## Start Command

```text
/goal Implement this goal.md without stopping until Vibe with Dashboard is Agent Skills-structured, target-repo scoped, strongly attached to agent work, proven by three freshly recreated project simulations passing twice after review, committed, and pushed to origin/main.
```

## Objective

Make Vibe with Dashboard reliable as an installable Agent Skill and monitoring-only dashboard for any local repo or worktree.

Done means all of the following are true:

- `skills/vibe-with-dashboard` and installed `.agents/skills/vibe-with-dashboard` use the Agent Skills tree shape:
  - `SKILL.md`
  - `scripts/`
  - `references/`
  - `assets/dashboard-app/`
  - `assets/rubber-duck/`
  - `agents/openai.yaml`
- The dashboard app runtime is self-contained under `assets/dashboard-app/`.
- The dashboard always monitors the target local repo or worktree where the agent is working.
- Target state is stored only in the target repo/worktree `.dashboard/`.
- The dashboard never needs to edit dashboard source code to show progress. Progress flows only through:
  `CLI -> REST API -> SQLite -> SSE -> React`.
- The Design System area records the target project design system and design tokens, not the dashboard app design system.
- The dashboard starts quietly from the agent/Codex execution context. It must not open a visible terminal or console window for normal users.
- Agent work units reliably appear in Plan, Kanban, Activity, and Rubber Duck suggestions.
- Three fresh sample projects pass the full simulation loop twice after the final improvement pass.
- Final verification passes, changes are committed, and `origin/main` is pushed.

## Read First

Before changing files, read and summarize only the parts needed from:

- `README.md`
- `INSTALL.md`
- `AGENTS.md`
- `CONTEXT.md`
- `vibe_with_dashboard.md`
- `skills/vibe-with-dashboard/SKILL.md`
- `.agents/skills/vibe-with-dashboard/SKILL.md`
- `bin/vibe-with-dashboard.js`
- `scripts/dashboard-ensure.cjs`
- `scripts/launcher.ts`
- `scripts/live-dashboard-smoke.cjs`
- `src/components/dashboard/dashboard-app.tsx`
- `src/lib/db/queries.ts`
- `src/lib/harness/project.ts`

Also use these external references when refining implementation details:

- Agent Skills specification: https://agentskills.io/specification
- Codex Agent Skills: https://developers.openai.com/codex/skills
- Codex hooks: https://developers.openai.com/codex/hooks
- Codex MCP: https://developers.openai.com/codex/mcp
- Codex subagents: https://developers.openai.com/codex/subagents
- Codex follow-goals: https://developers.openai.com/codex/use-cases/follow-goals

If documentation is unclear or likely changed, browse official docs again before deciding.

## Required Work Loop

Use `$vibe-with-dashboard` for this goal.

For every meaningful work unit:

1. Ensure the dashboard is running.
2. Check the current dashboard snapshot.
3. Move exactly one matching Work Card to `doing`.
4. Do the work.
5. Move that same card to `done` or `review`.
6. Record concise activity.
7. Seed 3-5 useful Rubber Duck suggestions, or explicitly clear suggestions with `suggest --clear`.
8. Run live dashboard smoke after CLI updates when the user-visible dashboard state matters.

Do not leave multiple cards in `doing` unless actual parallel implementation is happening.

## Subagent Strategy

Use subagents aggressively for exploration, review, and simulation.

Create or update project-scoped custom agent definitions under `.codex/agents/` if needed. Preferred default profile:

```toml
model = "gpt-5.5"
model_reasoning_effort = "xhigh"
```

Use the fastest available speed profile equivalent to `1.5x` if current Codex configuration supports an explicit speed key. If `gpt-5.5`, `xhigh`, or `1.5x` speed configuration is unsupported, do not silently invent a replacement. Record the limitation in dashboard activity and use the closest documented supported setting.

Use these specialized subagents whenever useful:

- `skill-structure-auditor`: checks Agent Skills tree layout, progressive disclosure, install artifacts, and runtime drift.
- `codex-docs-researcher`: verifies Codex skills, hooks, MCP, subagents, and goal behavior against current official docs.
- `dashboard-contract-reviewer`: reviews Plan/Kanban/Activity/Rubber Duck data flow and stale state risks.
- `design-system-auditor`: verifies that Design System data belongs to the target project, not this dashboard app.
- `simulation-runner`: runs the three fresh sample project simulations.
- `regression-reviewer`: reviews final changes for correctness, install safety, hidden terminal behavior, and missing tests.

Subagents should be read-heavy unless explicitly assigned implementation. Parent agent owns final edits, verification, commit, and push.

## Implementation Requirements

### Agent Skills Tree

Refactor the installable skill so the canonical layout is:

```text
skills/vibe-with-dashboard/
├── SKILL.md
├── scripts/
├── references/
├── assets/
│   ├── dashboard-app/
│   └── rubber-duck/
└── agents/
    └── openai.yaml
```

`SKILL.md` must stay focused on when and how to use the skill. Larger workflow docs move to `references/`. Executable helpers live in `scripts/`. The full Next app, package files, lockfile, public assets, and tests live under `assets/dashboard-app/`.

The repo-local mirror `.agents/skills/vibe-with-dashboard` must match the same structure.

### Runtime and Target Repo Scoping

Separate these roots everywhere:

- `skillRoot`: installed skill folder.
- `appRoot`: `skillRoot/assets/dashboard-app`.
- `projectRoot`: current target repo or worktree where the agent is doing user work.

The dashboard server runs from `appRoot`.

All state goes to `projectRoot/.dashboard/`, including:

- SQLite DB
- launcher state
- logs
- smoke state
- sample run artifacts for that target

Never write normal runtime state into the skill folder, except dependency installation inside `appRoot/node_modules`.

### Quiet Dashboard Launch

Normal dashboard startup must not show a visible terminal, console, PowerShell, cmd, Terminal.app, or shell window to non-technical users.

Required behavior:

- Start the dashboard through the agent/Codex execution context and detach it into a quiet background process.
- On Windows, prefer `nodew.exe` from the same Node installation so detached startup does not create a console window. If `nodew.exe` is unavailable, start `process.execPath` through a hidden Windows process wrapper such as `Win32_ProcessStartup.ShowWindow = 0`, inherit the dashboard environment, and redirect stdout/stderr to `.dashboard` log files.
- On macOS/Linux, use detached child processes with stdio redirected to log files or ignored.
- Do not use visible `cmd.exe`, visible PowerShell, `npm run dashboard`, or terminal-opening wrappers for normal ensure/start.
- Opening the browser is allowed, but it must not open a terminal window.
- Logs must be available in `projectRoot/.dashboard/`.
- Add a smoke or integration check that detects command construction likely to open visible terminals and confirms Windows launch command selection uses `nodew.exe` when present.

### Strong Dashboard Attachment

The dashboard must behave as a monitor for actual agent work.

Implement or document project-local Codex hook support:

- `SessionStart`: ensure dashboard, capture projectRoot, load snapshot.
- `UserPromptSubmit`: remind/import plan, seed or clear Rubber Duck suggestions.
- `PostToolUse`: detect meaningful work without card/activity updates.
- `Stop`: detect stale `doing`, missing `result`/`fail`, and missing live smoke.

Hooks must be project-local and trust-aware. Document that users may need to review/trust hooks through Codex hook tooling.

The hook path must be optional-enhancement safe: if hooks are unavailable or untrusted, the skill and CLI rules still work.

### Design System Panel

Rename or clarify dashboard UI so it is obvious that Design System means the target project design system.

Remove or hide dashboard-app design tokens from dashboard state and seed data.

The panel should show:

- target project token files, if detected
- target CSS custom properties or design token JSON, if detected
- agent-recorded design system notes, if provided
- empty state: `No project design system recorded`

Do not present the dashboard app's own Tailwind/theme variables as if they belonged to the target project.

### Rubber Duck

Rubber Duck advice is agent-written only.

At every new board or major checkpoint:

- seed 3-5 useful suggestions, or
- explicitly clear suggestions if none are useful.

Suggestions must be scoped to the active board, archived with the board, and cleared with a new active board.

Live smoke must confirm at least one chip when suggestions are expected, or idle state when suggestions are cleared.

## Recursive Simulation Loop

Use a dedicated temp root outside the user repo, such as:

```text
%TEMP%/vibe-dashboard-goal-simulations/
```

or the OS equivalent.

Before each recursive improvement loop:

1. Stop any dashboard processes started for previous sample projects.
2. Resolve the absolute temp simulation root.
3. Verify the path is inside the intended temp simulation root.
4. Delete all three previous sample projects.
5. Recreate all three sample projects from scratch.

Never delete the real user repo/worktree.

Create these sample projects each loop:

1. `react-tailwind-token-project`
   - A small React or Next project with CSS variables or token JSON.
   - Verifies target project design tokens appear in the dashboard.
2. `plain-node-cli-project`
   - A small Node CLI project with no design system.
   - Verifies empty design-system state and basic Plan/Kanban/Rubber Duck flow.
3. `git-worktree-or-monorepo-project`
   - A git repo with either a worktree or a small monorepo package.
   - Verifies projectRoot/worktree scoping and `.dashboard` placement.

For each sample project:

- install the skill project-locally
- ensure dashboard starts or reuses correctly
- confirm no visible terminal-opening command path is used
- plan a small task
- move one card to `doing`
- perform a tiny real file edit inside the sample project
- move card to `done`
- record activity
- seed Rubber Duck suggestions
- run live smoke
- archive the board
- verify DB/state lives in the sample project `.dashboard`
- verify app runtime comes from installed skill `assets/dashboard-app`

## Review and Improvement Loop

Run at most 5 recursive loops.

Each loop:

1. Run subagent reviews for skill structure, docs accuracy, dashboard contract, design system ownership, and simulation behavior.
2. Run the three fresh sample simulations.
3. Classify findings:
   - P0: data loss, destructive path risk, cannot install/start, wrong repo state mutation.
   - P1: dashboard progress not attached, Rubber Duck broken, design system shows dashboard tokens, visible terminal startup, failed smoke.
   - P2: confusing docs, weak labels, non-blocking warnings, minor gaps.
4. Fix all P0/P1 before the next loop.
5. Fix repeated P2 findings if they appear in two loops.
6. Delete and recreate sample projects before the next loop.

Stop only when:

- the latest loop has no P0/P1 findings
- no repeated P2 findings remain
- the three sample projects pass after being freshly recreated
- the same three sample projects pass again in one final confirmation loop after no further implementation changes

If loop 5 still has P1 or higher findings, stop with a `fail` dashboard activity and do not push.

## Final Verification Gate

After the recursive loop succeeds:

```bash
npm run runtime:check
npm run verify
npm run build
npm run e2e
node .agents/skills/vibe-with-dashboard/scripts/vibe-with-dashboard.js smoke
```

Also run a fresh install smoke for all three sample project types one final time.

Before commit:

- `git status --short`
- confirm no temp simulation projects are staged
- confirm no `.dashboard`, `.next`, `node_modules`, test-results, or logs are staged
- confirm no dashboard-app design tokens are presented as target project tokens
- confirm docs mention hidden/no-visible-terminal startup

If any final gate fails, fix and rerun the affected gate.

## Commit and Push

When all verification passes:

1. Record dashboard `result` activity.
2. Commit with a concise message, for example:
   ```bash
   git commit -m "Improve dashboard skill reliability goal"
   ```
3. Push to `origin/main`.
4. Confirm the pushed commit hash.

Do not push if:

- any final verification failed
- sample project simulation failed
- a P0/P1 finding remains
- git status contains unintended generated artifacts

## Progress Reporting

Keep progress reports compact.

Each report should name:

- current checkpoint
- what was verified
- what remains
- whether blocked

Do not store private reasoning, secrets, credentials, or long terminal dumps in dashboard activity.

## Assumptions

- Vibe with Dashboard remains monitoring-only.
- The web app never calls an LLM itself.
- CLI/API remains the required progress transport.
- MCP can be reviewed as an enhancement, but it is not the required v1 progress path.
- Subagents inherit the parent sandbox and approval mode.
- Temp project deletion is allowed only inside the dedicated simulation temp root after absolute-path verification.
- Final push is authorized only after every verification gate passes.
