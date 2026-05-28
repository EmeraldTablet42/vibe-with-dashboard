import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { addActivity, upsertSetting } from "../src/lib/db/queries";
import { ensureSeedData } from "../src/lib/db/seed";
import { getAppRoot, getProjectRoot } from "../src/lib/project-root";

const host = "127.0.0.1";
const port = Number(process.env.DASHBOARD_PORT ?? process.env.PORT ?? 3000);
const dashboardUrl = `http://${host}:${port}`;
const appRoot = getAppRoot();
const projectRoot = getProjectRoot();
const isDevMode = process.env.VIBE_DASHBOARD_DEV === "1";
const launchMode = isDevMode ? "development" : "production";
let child: ChildProcess | null = null;

function getNextCommand() {
  return process.platform === "win32"
    ? path.join(appRoot, "node_modules", ".bin", "next.cmd")
    : path.join(appRoot, "node_modules", ".bin", "next");
}

function newestMtime(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  const stat = fs.statSync(filePath);
  if (!stat.isDirectory()) return stat.mtimeMs;

  return fs
    .readdirSync(filePath)
    .reduce(
      (latest, entry) => Math.max(latest, newestMtime(path.join(filePath, entry))),
      stat.mtimeMs
    );
}

function needsBuild() {
  const buildId = path.join(appRoot, ".next", "BUILD_ID");
  if (!fs.existsSync(buildId)) return true;

  const buildTime = fs.statSync(buildId).mtimeMs;
  const watched = [
    "src",
    "public",
    "components.json",
    "next.config.ts",
    "package.json",
    "package-lock.json",
    "postcss.config.mjs",
    "tailwind.config.ts",
    "tsconfig.json",
  ];

  return watched.some((entry) => newestMtime(path.join(appRoot, entry)) > buildTime);
}

function runBuildIfNeeded() {
  if (isDevMode || !needsBuild()) return;

  upsertSetting("launcher_status", "building");
  console.log("[launcher] building production dashboard");
  const result = spawnSync(
    process.platform === "win32" ? "cmd.exe" : getNextCommand(),
    process.platform === "win32" ? ["/c", getNextCommand(), "build"] : ["build"],
    {
      cwd: appRoot,
      env: {
        ...process.env,
        DASHBOARD_PORT: String(port),
        PORT: String(port),
        VIBE_DASHBOARD_APP_ROOT: appRoot,
        VIBE_DASHBOARD_PROJECT_ROOT: projectRoot,
      },
      stdio: "inherit",
      windowsHide: true,
    }
  );

  if (result.status !== 0) {
    throw new Error(`next build failed with exit code ${result.status ?? 1}`);
  }
}

function startNext() {
  runBuildIfNeeded();

  const command = process.platform === "win32" ? "cmd.exe" : getNextCommand();
  const nextArgs = isDevMode
    ? ["dev", "--turbopack", "--hostname", host, "--port", String(port)]
    : ["start", "--hostname", host, "--port", String(port)];
  const args =
    process.platform === "win32" ? ["/c", getNextCommand(), ...nextArgs] : nextArgs;

  child = spawn(command, args, {
    cwd: appRoot,
    env: {
      ...process.env,
      DASHBOARD_PORT: String(port),
      PORT: String(port),
      VIBE_DASHBOARD_APP_ROOT: appRoot,
      VIBE_DASHBOARD_PROJECT_ROOT: projectRoot,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout?.on("data", (chunk) => {
    process.stdout.write(`[next] ${chunk}`);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(`[next] ${chunk}`);
  });
  child.on("exit", (code) => {
    process.stdout.write(`[next] exited ${code}\n`);
  });
}

function stop() {
  upsertSetting("launcher_status", "stopping");
  if (child && !child.killed && child.exitCode === null) {
    child.kill("SIGINT");
    setTimeout(() => {
      if (!child || child.killed || child.exitCode !== null) return;
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          windowsHide: true,
        });
      } else {
        child.kill("SIGTERM");
      }
    }, 4_000).unref();
  }

  setTimeout(() => {
    upsertSetting("launcher_status", "stopped");
    process.exit(0);
  }, 5_000).unref();
}

ensureSeedData();
upsertSetting("dashboard_url", dashboardUrl);
upsertSetting("dashboard_port", String(port));
upsertSetting("launcher_status", "online");
addActivity({
  phase: "start",
  source: "launcher",
  status: "done",
  task: "server",
  title: "Dashboard server online",
  message: dashboardUrl,
  metadata: { mode: launchMode, port, projectRoot },
});

startNext();
console.log(
  `[launcher] dashboard ${dashboardUrl} mode=${launchMode} project=${projectRoot}`
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, stop);
}
