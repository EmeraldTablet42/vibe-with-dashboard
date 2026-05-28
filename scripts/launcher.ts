import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

import { addActivity, upsertSetting } from "../src/lib/db/queries";
import { ensureSeedData } from "../src/lib/db/seed";

const host = "127.0.0.1";
const port = Number(process.env.DASHBOARD_PORT ?? process.env.PORT ?? 3000);
const dashboardUrl = `http://${host}:${port}`;
let child: ChildProcess | null = null;

function getNextCommand() {
  return process.platform === "win32"
    ? path.join(process.cwd(), "node_modules", ".bin", "next.cmd")
    : path.join(process.cwd(), "node_modules", ".bin", "next");
}

function startNext() {
  const command = process.platform === "win32" ? "cmd.exe" : getNextCommand();
  const args =
    process.platform === "win32"
      ? [
          "/c",
          getNextCommand(),
          "dev",
          "--turbopack",
          "--hostname",
          host,
          "--port",
          String(port),
        ]
      : ["dev", "--turbopack", "--hostname", host, "--port", String(port)];

  child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, DASHBOARD_PORT: String(port), PORT: String(port) },
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
  metadata: { port },
});

startNext();
console.log(`[launcher] dashboard ${dashboardUrl}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, stop);
}
