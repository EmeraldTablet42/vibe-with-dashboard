#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const REPO = "EmeraldTablet42/vibe-with-dashboard";
const SKILL_NAME = "vibe-with-dashboard";
const STATE_DIR = ".dashboard";
const LEGACY_INSTALL_DIR = ".vibe-with-dashboard";
const MARKER_BEGIN = "<!-- vibe-with-dashboard:start -->";
const MARKER_END = "<!-- vibe-with-dashboard:end -->";

process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit(0);
  throw error;
});

const PROVIDERS = [
  { id: "codex", label: "Codex CLI", command: "codex", skillsProfile: "codex" },
  { id: "claude", label: "Claude Code", command: "claude", skillsProfile: "claude" },
  { id: "gemini", label: "Gemini CLI", command: "gemini", skillsProfile: "gemini" },
  { id: "cursor", label: "Cursor", skillsProfile: "cursor" },
  { id: "windsurf", label: "Windsurf", skillsProfile: "windsurf" },
  { id: "cline", label: "Cline", skillsProfile: "cline" },
  { id: "roo", label: "Roo Code", skillsProfile: "roo" },
  { id: "kilo", label: "Kilo Code", skillsProfile: "kilo" },
  { id: "continue", label: "Continue", skillsProfile: "continue" },
  { id: "copilot", label: "GitHub Copilot", command: "gh", skillsProfile: "copilot", soft: true },
  { id: "opencode", label: "opencode", command: "opencode", skillsProfile: "opencode" },
  { id: "aider-desk", label: "Aider Desk", skillsProfile: "aider-desk" },
  { id: "junie", label: "JetBrains Junie", skillsProfile: "junie", soft: true },
  { id: "kiro-cli", label: "Kiro CLI", skillsProfile: "kiro-cli", soft: true },
  { id: "qwen-code", label: "Qwen Code", skillsProfile: "qwen-code", soft: true },
  { id: "openhands", label: "OpenHands", skillsProfile: "openhands", soft: true },
  { id: "goose", label: "Block Goose", skillsProfile: "goose", soft: true },
  { id: "augment", label: "Augment Code", skillsProfile: "augment", soft: true },
  { id: "amp", label: "Sourcegraph Amp", skillsProfile: "amp", soft: true },
  { id: "warp", label: "Warp", skillsProfile: "warp", soft: true },
  { id: "replit", label: "Replit Agent", skillsProfile: "replit", soft: true },
];

const PROVIDER_PATHS = {
  codex: [".agents", ".codex"],
  claude: [".claude"],
  gemini: [".gemini"],
  cursor: [".cursor"],
  windsurf: [".windsurf"],
  cline: [".clinerules", ".cline"],
  roo: [".roo"],
  kilo: [".kiro", ".kilo"],
  continue: [".continue"],
  copilot: [".github/copilot-instructions.md"],
  opencode: [".opencode"],
  "aider-desk": [".aider"],
  junie: [".junie"],
  "kiro-cli": [".kiro"],
  "qwen-code": [".qwen"],
  openhands: [".openhands"],
  goose: [".goose"],
  augment: [".augment"],
  amp: [".amp"],
  warp: [".warp"],
  replit: [".replit"],
};

const COMMANDS = new Set([
  "install",
  "ensure",
  "activity",
  "plan",
  "card",
  "suggest",
  "archive",
  "snapshot",
  "smoke",
  "list",
]);

function packageRoot() {
  return path.resolve(__dirname, "..");
}

function isRuntimeRoot(candidate) {
  return (
    exists(path.join(candidate, "SKILL.md")) &&
    exists(path.join(candidate, "package.json")) &&
    exists(path.join(candidate, "bin", "vibe-with-dashboard.js")) &&
    exists(path.join(candidate, "scripts", "dashboard-ensure.cjs")) &&
    exists(path.join(candidate, "src"))
  );
}

function isDevRepoRoot(candidate) {
  return (
    exists(path.join(candidate, "package.json")) &&
    exists(path.join(candidate, "skills", SKILL_NAME, "SKILL.md")) &&
    exists(path.join(candidate, "scripts", "dashboard-ensure.cjs")) &&
    exists(path.join(candidate, "src"))
  );
}

function skillRuntimePath(projectRoot) {
  return path.join(projectRoot, ".agents", "skills", SKILL_NAME);
}

function log(message) {
  process.stdout.write(`[vibe-with-dashboard] ${message}\n`);
}

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      args._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    const value = !next || next.startsWith("--") ? true : next;
    if (value !== true) index += 1;
    if (
      key === "only" ||
      key === "card" ||
      key === "card-json" ||
      key === "card-update" ||
      key === "milestone-json" ||
      key === "suggestion-json"
    ) {
      args[key] = [...(args[key] || []), value];
    } else {
      args[key] = value;
    }
  }
  return args;
}

function commandExists(command) {
  const checker = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(checker, [command], {
    stdio: "ignore",
    windowsHide: true,
  });
  return result.status === 0;
}

function providerDetected(provider, projectRoot) {
  if (!provider.soft && provider.command && commandExists(provider.command)) return true;
  return (PROVIDER_PATHS[provider.id] || []).some((candidate) =>
    exists(path.join(projectRoot, candidate))
  );
}

function selectedProviders(flags, projectRoot) {
  if (flags.all) {
    return PROVIDERS.filter((provider) => providerDetected(provider, projectRoot));
  }
  if (flags.only?.length) {
    const requested = new Set(flags.only.map(String));
    return PROVIDERS.filter((provider) => requested.has(provider.id));
  }
  return [];
}

function printProviderList(projectRoot) {
  for (const provider of PROVIDERS) {
    const detected = providerDetected(provider, projectRoot) ? "detected" : "manual";
    const soft = provider.soft ? " soft" : "";
    process.stdout.write(`${provider.id.padEnd(12)} ${detected}${soft} ${provider.label}\n`);
  }
}

function resolveProjectRoot(flags) {
  return path.resolve(String(flags.project || process.cwd()));
}

function resolveAppRoot(projectRoot) {
  if (
    process.env.VIBE_DASHBOARD_APP_ROOT &&
    exists(path.join(process.env.VIBE_DASHBOARD_APP_ROOT, "package.json"))
  ) {
    return path.resolve(process.env.VIBE_DASHBOARD_APP_ROOT);
  }

  const currentRoot = packageRoot();
  if (isRuntimeRoot(currentRoot)) return currentRoot;

  const projectSkillRoot = skillRuntimePath(projectRoot);
  if (isRuntimeRoot(projectSkillRoot)) return projectSkillRoot;

  const legacyApp = path.join(projectRoot, LEGACY_INSTALL_DIR, "app");
  if (exists(path.join(legacyApp, "package.json"))) return legacyApp;

  if (isDevRepoRoot(currentRoot)) return currentRoot;

  return currentRoot;
}

function copyRecursive(source, target, dryRun) {
  const ignored = new Set([
    ".git",
    ".dashboard",
    ".next",
    LEGACY_INSTALL_DIR,
    "node_modules",
    "coverage",
    "test-results",
    "playwright-report",
  ]);
  const name = path.basename(source);
  if (ignored.has(name)) return;
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    if (!dryRun) fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry), dryRun);
    }
    return;
  }
  if (!dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

function resolveSkillSourceRoot(sourceRoot) {
  if (isRuntimeRoot(sourceRoot)) return sourceRoot;
  const nestedSkill = path.join(sourceRoot, "skills", SKILL_NAME);
  if (exists(path.join(nestedSkill, "SKILL.md"))) return nestedSkill;
  throw new Error(`skill source missing: ${nestedSkill}`);
}

function copySkill(sourceRoot, targetRoot, dryRun) {
  const source = resolveSkillSourceRoot(sourceRoot);
  const target = skillRuntimePath(targetRoot);
  if (path.resolve(source) === path.resolve(target)) {
    log("project skill runtime already installed");
    return;
  }
  log(`${dryRun ? "would install" : "install"} project skill runtime at ${target}`);
  copyRecursive(source, target, dryRun);
}

function writeMarkerFile(filePath, body, dryRun) {
  const block = `${MARKER_BEGIN}\n${body.trim()}\n${MARKER_END}\n`;
  const current = exists(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const next = current.includes(MARKER_BEGIN)
    ? current.replace(
        new RegExp(`${MARKER_BEGIN}[\\s\\S]*?${MARKER_END}\\n?`),
        block
      )
    : `${current}${current && !current.endsWith("\n") ? "\n" : ""}\n${block}`;
  log(`${dryRun ? "would update" : "update"} ${filePath}`);
  if (!dryRun) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, next);
  }
}

function installProjectRules(projectRoot, dryRun) {
  const localCli = "node .agents/skills/vibe-with-dashboard/bin/vibe-with-dashboard.js";
  const body = [
    "# Vibe with Dashboard",
    "",
    "Use `$vibe-with-dashboard` when project work should be reflected in the local monitoring dashboard.",
    `Before work, run \`${localCli} ensure\`.`,
    "Use detailed `plan --plan-json` for real work plans, then `snapshot` before choosing the next Work Card.",
    "If Plan Mode emits `<proposed_plan>`, convert it to detailed `plan --plan-json`; preserve sections, execution bullets, tests, and assumptions.",
    "Record plan, implement, verify, result, and fail updates with the project-local Vibe with Dashboard CLI.",
    "Before each meaningful work unit, move exactly one matching Work Card to `doing` with `card --card \"...\" --status doing` or activity card flags.",
    "When that work unit finishes, move the same card to `done` or `review`; do not leave multiple cards in `doing` unless the user requested parallel work.",
    "If no Work Card matches the unit, update the Plan first instead of working invisibly.",
    "Completed boards archive automatically after all cards are done and result activity is recorded.",
    "Include `translations` for Plan/Kanban titles and summaries in both the user's locale and `en` when the user's locale is known.",
    "Use `suggest --suggestion-json` for Rubber Duck suggestions when project advice should be visible; otherwise explicitly clear suggestions.",
    "After CLI updates, run `smoke` to verify the live dashboard URL, active focus card, Plan doing card, Kanban doing card, and Rubber Duck chips.",
    "Progress updates must use the CLI/API state path, not dashboard source-code edits.",
    "Keep dashboard entries concise and never store secrets, credentials, private reasoning, or long terminal logs.",
  ].join("\n");
  writeMarkerFile(path.join(projectRoot, "AGENTS.md"), body, dryRun);
  writeMarkerFile(path.join(projectRoot, "CLAUDE.md"), body, dryRun);
  writeMarkerFile(path.join(projectRoot, "GEMINI.md"), body, dryRun);
}

function installGlobalSkill(sourceRoot, dryRun) {
  const source = resolveSkillSourceRoot(sourceRoot);
  const targets = [
    path.join(os.homedir(), ".agents", "skills", SKILL_NAME),
    path.join(os.homedir(), ".codex", "skills", SKILL_NAME),
  ];
  for (const target of targets) {
    log(`${dryRun ? "would install" : "install"} global skill runtime at ${target}`);
    copyRecursive(source, target, dryRun);
  }
}

function runSkillsCliInstall(providers, dryRun) {
  for (const provider of providers) {
    const args = ["-y", "skills", "add", REPO, "-a", provider.skillsProfile, "-y"];
    log(`${dryRun ? "would run" : "run"} npx ${args.join(" ")}`);
    if (dryRun) continue;
    const result = spawnSync("npx", args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      windowsHide: true,
    });
    if (result.status !== 0) {
      throw new Error(`skills install failed for ${provider.id}`);
    }
  }
}

function runNodeScript(scriptName, projectRoot) {
  const appRoot = resolveAppRoot(projectRoot);
  const result = spawnSync("node", [path.join(appRoot, "scripts", scriptName)], {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      VIBE_DASHBOARD_APP_ROOT: appRoot,
      VIBE_DASHBOARD_PROJECT_ROOT: projectRoot,
    },
    windowsHide: true,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

function readDashboardUrl(projectRoot) {
  if (process.env.DASHBOARD_URL) return process.env.DASHBOARD_URL;
  try {
    const state = JSON.parse(
      fs.readFileSync(path.join(projectRoot, STATE_DIR, "state.json"), "utf8")
    );
    if (state?.url) return state.url;
  } catch {
    // fall through
  }
  return "http://127.0.0.1:3000";
}

function requestJson(url, payload, method = "POST") {
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        },
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(responseBody || `HTTP ${response.statusCode}`));
            return;
          }
          resolve(responseBody);
        });
      }
    );
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

function postJson(url, payload) {
  return requestJson(url, payload, "POST");
}

function getJson(url) {
  return requestJson(url, undefined, "GET");
}

function parseCard(value) {
  const [
    title,
    summary = "",
    priority = "medium",
    status = "ready",
    translationsJson = "",
  ] = String(value).split("::");
  return {
    title,
    summary,
    priority,
    status,
    translations: translationsJson ? JSON.parse(translationsJson) : undefined,
  };
}

function parseJsonFlag(value, fallback = undefined) {
  if (!value) return fallback;
  return JSON.parse(String(value));
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePlanFlags(flags) {
  const planJson = parseJsonFlag(flags["plan-json"]);
  if (planJson) return planJson;
  return {
    task: String(flags.task || flags._[0] || "").trim(),
    title: flags.title,
    summary: flags.summary,
    translations: parseJsonFlag(flags.translations),
    milestone: parseJsonFlag(flags.milestone),
    milestones: flags["milestone-json"]?.map((value) => JSON.parse(String(value))),
    replace: flags.replace ? true : undefined,
    source: flags.source || "agent",
    cards: [
      ...(flags.card?.map(parseCard) || []),
      ...(flags["card-json"]?.map((value) => JSON.parse(String(value))) || []),
    ],
  };
}

function parseCardUpdateFlags(flags) {
  const updates = [
    ...(flags["card-update"]?.map((value) => JSON.parse(String(value))) || []),
  ];

  if (flags.card || flags["card-title"] || flags["card-id"] || flags.status) {
    updates.push({
      id: flags["card-id"],
      title: flags["card-title"] || firstValue(flags.card),
      status: flags.status || flags["card-status"],
      priority: flags.priority || flags["card-priority"],
      summary: flags.summary,
      owner: flags.owner,
      size: flags.size,
      acceptanceCriteria: flags["acceptance-criteria"],
      verificationCommand: flags["verification-command"],
      dependsOn: parseJsonFlag(flags["depends-on"]),
      translations: parseJsonFlag(flags.translations),
    });
  }

  return updates.filter((update) => update.id || update.title);
}

function summarizeSnapshot(raw) {
  const snapshot = JSON.parse(raw);
  const lines = [
    `${snapshot.board.title || "No active plan"} (${snapshot.board.status})`,
    `Task: ${snapshot.board.task || "-"}`,
  ];
  for (const goal of snapshot.goals || []) {
    lines.push(`Goal: ${goal.title} [${goal.status}]`);
    for (const milestone of goal.milestones || []) {
      lines.push(`  Milestone: ${milestone.title} [${milestone.status}]`);
      for (const card of milestone.cards || []) {
        lines.push(
          `    - ${card.title} [${card.status}/${card.priority}] ${card.summary || ""}`.trimEnd()
        );
      }
    }
  }
  return lines.join("\n");
}

async function main(argv = process.argv.slice(2)) {
  let command = argv[0];
  let rest = argv.slice(1);
  if (!COMMANDS.has(command)) {
    command = command?.startsWith("--") || !command ? "install" : command;
    rest = command === "install" ? argv : rest;
  }

  const flags = parseArgs(rest);
  const projectRoot = resolveProjectRoot(flags);

  if (command === "list") {
    printProviderList(projectRoot);
    return;
  }

  if (command === "install") {
    if (flags.list) {
      printProviderList(projectRoot);
      return;
    }
    const dryRun = Boolean(flags["dry-run"]);
    copySkill(packageRoot(), projectRoot, dryRun);
    installProjectRules(projectRoot, dryRun);
    if (flags.global) installGlobalSkill(packageRoot(), dryRun);
    runSkillsCliInstall(selectedProviders(flags, projectRoot), dryRun);
    log(dryRun ? "dry run complete" : "install complete");
    return;
  }

  if (command === "ensure") {
    runNodeScript("dashboard-ensure.cjs", projectRoot);
    return;
  }

  if (command === "smoke") {
    runNodeScript("live-dashboard-smoke.cjs", projectRoot);
    return;
  }

  const baseUrl = readDashboardUrl(projectRoot);

  if (command === "snapshot") {
    const response = await getJson(`${baseUrl}/api/dashboard/snapshot`);
    process.stdout.write(flags.json ? response : `${summarizeSnapshot(response)}\n`);
    return;
  }

  if (command === "activity") {
    const phase = String(flags.phase || "implement");
    const cardUpdates = parseCardUpdateFlags(flags);
    await postJson(`${baseUrl}/api/agent/activity`, {
      phase,
      source: flags.source || "agent",
      status: flags.status || (phase === "fail" ? "failed" : "done"),
      task: flags.task || "",
      title: flags.title || phase,
      message: flags.message || flags.title || "Activity recorded",
      metadata: flags.metadata ? JSON.parse(String(flags.metadata)) : {},
      cards: cardUpdates.length > 0 ? cardUpdates : undefined,
    });
    log(`${phase}: ${flags.message || flags.title || "Activity recorded"}`);
    return;
  }

  if (command === "plan") {
    const payload = parsePlanFlags(flags);
    if (!payload.task) throw new Error("plan requires --task or --plan-json with task");
    await postJson(`${baseUrl}/api/agent/plan`, payload);
    log(`plan: ${payload.task}`);
    return;
  }

  if (command === "card") {
    const updates = parseCardUpdateFlags(flags);
    if (updates.length === 0) {
      throw new Error("card requires --card, --card-title, --card-id, or --card-update");
    }
    await postJson(`${baseUrl}/api/agent/cards`, { updates });
    log(`card updates: ${updates.length}`);
    return;
  }

  if (command === "suggest") {
    const suggestions = flags.clear
      ? []
      : flags["suggestion-json"]?.map((value) => JSON.parse(String(value))) || [];
    await postJson(`${baseUrl}/api/agent/suggestions`, {
      source: flags.source || "agent",
      suggestions,
    });
    log(flags.clear ? "suggestions cleared" : `suggestions: ${suggestions.length}`);
    return;
  }

  if (command === "archive") {
    const response = await postJson(`${baseUrl}/api/dashboard/archive`, {});
    log(`archive: ${response}`);
  }
}

main().catch((error) => {
  console.error(`[vibe-with-dashboard] ${error.message}`);
  process.exit(1);
});
