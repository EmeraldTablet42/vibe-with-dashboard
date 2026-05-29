#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const tempRoot = path.join(os.tmpdir(), "vibe-dashboard-goal-simulations");
const sampleNames = [
  "react-tailwind-token-project",
  "plain-node-cli-project",
  "git-worktree-or-monorepo-project",
];

function log(message) {
  process.stdout.write(`[goal-sim] ${message}\n`);
}

function assertInsideTempRoot(target) {
  const resolvedTemp = path.resolve(tempRoot);
  const resolvedTarget = path.resolve(target);
  if (
    resolvedTarget !== resolvedTemp &&
    !resolvedTarget.startsWith(`${resolvedTemp}${path.sep}`)
  ) {
    throw new Error(`refusing to touch path outside simulation root: ${resolvedTarget}`);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      DASHBOARD_NO_BROWSER: "1",
      ...options.env,
    },
    windowsHide: true,
    stdio: options.stdio || "pipe",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed in ${options.cwd || repoRoot}\n${result.stdout || ""}${result.stderr || ""}`
    );
  }
  return result;
}

function stopDashboard(projectRoot) {
  const statePath = path.join(projectRoot, ".dashboard", "state.json");
  if (!fs.existsSync(statePath)) return;
  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const pid = Number(state.pid);
    if (!Number.isFinite(pid) || pid <= 0) return;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // already stopped
      }
    }
  } catch {
    // stale state can be ignored before recreation
  }
}

function resetSimulationRoot() {
  assertInsideTempRoot(tempRoot);
  for (const name of sampleNames) {
    const sample = path.join(tempRoot, name);
    stopDashboard(sample);
    assertInsideTempRoot(sample);
    fs.rmSync(sample, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 250,
    });
  }
  fs.mkdirSync(tempRoot, { recursive: true });
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function createSample(name) {
  const project = path.join(tempRoot, name);
  fs.mkdirSync(project, { recursive: true });

  if (name === "react-tailwind-token-project") {
    writeFile(
      path.join(project, "package.json"),
      JSON.stringify({ name, private: true, scripts: { test: "node smoke.js" } }, null, 2)
    );
    writeFile(
      path.join(project, "src", "app.css"),
      ":root { --brand-primary: oklch(0.7 0.18 210); --space-card: 12px; }\n"
    );
    writeFile(
      path.join(project, "design-tokens.json"),
      JSON.stringify({ color: { accent: { value: "#14b8a6" } } }, null, 2)
    );
    writeFile(path.join(project, "smoke.js"), "console.log('react token smoke')\n");
  } else if (name === "plain-node-cli-project") {
    writeFile(
      path.join(project, "package.json"),
      JSON.stringify(
        { name, private: true, bin: { sample: "cli.js" }, scripts: { test: "node cli.js" } },
        null,
        2
      )
    );
    writeFile(path.join(project, "cli.js"), "console.log('plain node cli')\n");
  } else {
    writeFile(
      path.join(project, "package.json"),
      JSON.stringify({ name, private: true, workspaces: ["packages/*"] }, null, 2)
    );
    writeFile(
      path.join(project, "packages", "worker", "package.json"),
      JSON.stringify({ name: "worker", private: true }, null, 2)
    );
    writeFile(path.join(project, "packages", "worker", "index.js"), "console.log('worker')\n");
    run("git", ["init"], { cwd: project });
  }

  return project;
}

function cli(projectRoot) {
  return path.join(projectRoot, ".agents", "skills", "vibe-with-dashboard", "scripts", "vibe-with-dashboard.js");
}

function installSkill(projectRoot) {
  run(process.execPath, ["bin/vibe-with-dashboard.js", "install", "--project", projectRoot], {
    cwd: repoRoot,
  });
}

function readSnapshot(projectRoot) {
  const result = run(process.execPath, [cli(projectRoot), "snapshot", "--json"], {
    cwd: projectRoot,
  });
  return JSON.parse(result.stdout);
}

function verifySkillLayout(projectRoot) {
  const skillRoot = path.join(projectRoot, ".agents", "skills", "vibe-with-dashboard");
  const appRoot = path.join(skillRoot, "assets", "dashboard-app");
  for (const required of [
    "SKILL.md",
    "scripts/vibe-with-dashboard.js",
    "references/WORKFLOW.md",
    "assets/rubber-duck/rubber-duck-2d5.png",
    "agents/openai.yaml",
    "assets/dashboard-app/package.json",
    "assets/dashboard-app/src/app/page.tsx",
  ]) {
    if (!fs.existsSync(path.join(skillRoot, required))) {
      throw new Error(`${path.basename(projectRoot)} missing skill entry ${required}`);
    }
  }

  const ensure = fs.readFileSync(path.join(skillRoot, "scripts", "dashboard-ensure.cjs"), "utf8");
  for (const marker of ["nodew.exe", "ShowWindow = 0", "startLauncherWithHiddenWindowsProcess"]) {
    if (!ensure.includes(marker)) {
      throw new Error(`${path.basename(projectRoot)} quiet launch marker missing: ${marker}`);
    }
  }

  return { skillRoot, appRoot };
}

function runSimulation(projectRoot, name) {
  installSkill(projectRoot);
  const { appRoot } = verifySkillLayout(projectRoot);

  run(process.execPath, [cli(projectRoot), "ensure"], { cwd: projectRoot });
  const state = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".dashboard", "state.json"), "utf8")
  );
  if (path.resolve(state.projectRoot) !== path.resolve(projectRoot)) {
    throw new Error(`${name} state projectRoot mismatch`);
  }
  if (path.resolve(state.appRoot) !== path.resolve(appRoot)) {
    throw new Error(`${name} state appRoot mismatch`);
  }

  const cardTitle = `Edit ${name}`;
  run(
    process.execPath,
    [
      cli(projectRoot),
      "plan",
      "--plan-json",
      JSON.stringify({
        task: `${name} simulation`,
        title: `${name} simulation`,
        replace: true,
        milestones: [
          {
            title: "Simulate",
            cards: [{ title: cardTitle, status: "ready", priority: "high" }],
          },
        ],
      }),
    ],
    { cwd: projectRoot }
  );
  run(process.execPath, [cli(projectRoot), "card", "--card", cardTitle, "--status", "doing"], {
    cwd: projectRoot,
  });
  run(
    process.execPath,
    [
      cli(projectRoot),
      "suggest",
      "--suggestion-json",
      JSON.stringify({
        keyword: "Verify",
        title: "Check simulation",
        actionPrompt: "Verify the sample project simulation.",
        priority: "high",
      }),
    ],
    { cwd: projectRoot }
  );

  const doingSnapshot = readSnapshot(projectRoot);
  if (name === "react-tailwind-token-project") {
    const names = doingSnapshot.designTokens.map((token) => token.name);
    if (!names.includes("--brand-primary") || !names.includes("color.accent")) {
      throw new Error(`${name} did not expose target project design tokens`);
    }
  }
  if (name === "plain-node-cli-project" && doingSnapshot.designTokens.length !== 0) {
    throw new Error(`${name} should have no project design tokens`);
  }

  run(process.execPath, [cli(projectRoot), "smoke", "--timeout", "120000"], {
    cwd: projectRoot,
  });
  writeFile(path.join(projectRoot, "agent-edit.txt"), `edited ${new Date().toISOString()}\n`);
  run(
    process.execPath,
    [
      cli(projectRoot),
      "activity",
      "--phase",
      "result",
      "--title",
      "Done",
      "--message",
      "Simulation complete",
      "--card",
      cardTitle,
      "--card-status",
      "done",
    ],
    { cwd: projectRoot }
  );

  const finalSnapshot = readSnapshot(projectRoot);
  if (!finalSnapshot.board.isEmpty || finalSnapshot.archives.length === 0) {
    throw new Error(`${name} did not archive completed board`);
  }
  if (!fs.existsSync(path.join(projectRoot, ".dashboard", "dashboard.sqlite"))) {
    throw new Error(`${name} missing project .dashboard SQLite state`);
  }
  if (fs.existsSync(path.join(appRoot, ".dashboard"))) {
    throw new Error(`${name} wrote dashboard state under appRoot`);
  }

  stopDashboard(projectRoot);
  log(`${name} passed`);
}

function main() {
  const loops = Number(process.argv[2] || 1);
  assertInsideTempRoot(tempRoot);
  log(`root ${tempRoot}`);
  for (let loop = 1; loop <= loops; loop += 1) {
    log(`loop ${loop} recreate`);
    resetSimulationRoot();
    for (const name of sampleNames) {
      runSimulation(createSample(name), name);
    }
  }
  log(`passed ${loops} loop(s)`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`[goal-sim] ${error.message}\n`);
  process.exit(1);
}
