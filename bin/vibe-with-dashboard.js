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
const INSTALL_DIR = ".vibe-with-dashboard";
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

const COMMANDS = new Set(["install", "ensure", "activity", "plan", "archive", "list"]);

function packageRoot() {
  return path.resolve(__dirname, "..");
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
    if (key === "only" || key === "card" || key === "card-json") {
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
  const localApp = path.join(projectRoot, INSTALL_DIR, "app");
  if (exists(path.join(localApp, "package.json"))) return localApp;
  return packageRoot();
}

function copyRecursive(source, target, dryRun) {
  const ignored = new Set([
    ".git",
    ".dashboard",
    ".next",
    ".vibe-with-dashboard",
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

function copyApp(projectRoot, dryRun) {
  const sourceRoot = packageRoot();
  const targetRoot = path.join(projectRoot, INSTALL_DIR, "app");
  if (path.resolve(sourceRoot) === path.resolve(projectRoot)) {
    log("using current repository as dashboard app");
    return;
  }

  log(`${dryRun ? "would copy" : "copy"} app to ${targetRoot}`);
  for (const entry of fs.readdirSync(sourceRoot)) {
    copyRecursive(path.join(sourceRoot, entry), path.join(targetRoot, entry), dryRun);
  }
  const appPackage = path.join(sourceRoot, "templates", "app-package.json");
  if (exists(appPackage)) {
    log(`${dryRun ? "would write" : "write"} dashboard app package.json`);
    if (!dryRun) {
      fs.copyFileSync(appPackage, path.join(targetRoot, "package.json"));
    }
  }
}

function copySkill(sourceRoot, targetRoot, dryRun) {
  const source = path.join(sourceRoot, "skills", SKILL_NAME);
  const target = path.join(targetRoot, ".agents", "skills", SKILL_NAME);
  if (!exists(path.join(source, "SKILL.md"))) {
    throw new Error(`skill source missing: ${source}`);
  }
  log(`${dryRun ? "would install" : "install"} project skill at ${target}`);
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
  const body = [
    "# Vibe with Dashboard",
    "",
    "Use `$vibe-with-dashboard` when project work should be reflected in the local monitoring dashboard.",
    "Before work, run `node .vibe-with-dashboard/app/bin/vibe-with-dashboard.js ensure`.",
    "Record plan, implement, verify, result, and fail updates with the project-local Vibe with Dashboard CLI.",
    "Include `translations` for Plan/Kanban titles and summaries when the user's locale is known.",
    "Keep dashboard entries concise and never store secrets, credentials, private reasoning, or long terminal logs.",
  ].join("\n");
  writeMarkerFile(path.join(projectRoot, "AGENTS.md"), body, dryRun);
  writeMarkerFile(path.join(projectRoot, "CLAUDE.md"), body, dryRun);
  writeMarkerFile(path.join(projectRoot, "GEMINI.md"), body, dryRun);
}

function installGlobalSkill(sourceRoot, dryRun) {
  const targets = [
    path.join(os.homedir(), ".agents", "skills", SKILL_NAME),
    path.join(os.homedir(), ".codex", "skills", SKILL_NAME),
  ];
  for (const target of targets) {
    log(`${dryRun ? "would install" : "install"} global skill at ${target}`);
    copyRecursive(path.join(sourceRoot, "skills", SKILL_NAME), target, dryRun);
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

function postJson(url, payload) {
  const body = JSON.stringify(payload);
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
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
    request.write(body);
    request.end();
  });
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
    copyApp(projectRoot, dryRun);
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

  const baseUrl = readDashboardUrl(projectRoot);

  if (command === "activity") {
    const phase = String(flags.phase || "implement");
    await postJson(`${baseUrl}/api/agent/activity`, {
      phase,
      source: flags.source || "agent",
      status: flags.status || (phase === "fail" ? "failed" : "done"),
      task: flags.task || "",
      title: flags.title || phase,
      message: flags.message || flags.title || "Activity recorded",
      metadata: flags.metadata ? JSON.parse(String(flags.metadata)) : {},
    });
    log(`${phase}: ${flags.message || flags.title || "Activity recorded"}`);
    return;
  }

  if (command === "plan") {
    const task = String(flags.task || flags._[0] || "").trim();
    if (!task) throw new Error("plan requires --task");
    await postJson(`${baseUrl}/api/agent/plan`, {
      task,
      title: flags.title,
      summary: flags.summary,
      translations: parseJsonFlag(flags.translations),
      milestone: parseJsonFlag(flags.milestone),
      source: flags.source || "agent",
      cards: [
        ...(flags.card?.map(parseCard) || []),
        ...(flags["card-json"]?.map((value) => JSON.parse(String(value))) || []),
      ],
    });
    log(`plan: ${task}`);
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
