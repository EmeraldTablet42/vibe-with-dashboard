import { spawn, type ChildProcess } from "node:child_process";

import { getSetting, upsertSetting } from "../src/lib/db/queries";
import { ensureSeedData } from "../src/lib/db/seed";

type ManagedProcess = {
  name: string;
  child: ChildProcess;
};

const children: ManagedProcess[] = [];

function start(name: string, script: string) {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args =
    process.platform === "win32"
      ? ["/c", "npm", "run", script]
      : ["run", script];
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout?.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });
  child.on("exit", (code) => {
    process.stdout.write(`[${name}] exited ${code}\n`);
  });

  children.push({ name, child });
}

function stopChild({ child, name }: ManagedProcess) {
  if (child.killed || child.exitCode !== null) return;
  console.log(`[launcher] stopping ${name}`);
  child.kill("SIGINT");

  setTimeout(() => {
    if (child.killed || child.exitCode !== null) return;
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        windowsHide: true,
      });
    } else {
      child.kill("SIGTERM");
    }
  }, 4_000).unref();
}

async function shutdown() {
  upsertSetting("launcher_status", "stopping");
  for (const child of children) stopChild(child);
  setTimeout(() => {
    upsertSetting("launcher_status", "stopped");
    process.exit(0);
  }, 5_000).unref();
}

ensureSeedData();
upsertSetting("shutdown_requested", "false");
upsertSetting("launcher_status", "starting");

start("next", "dev:next");
start("mcp", "mcp");

upsertSetting("launcher_status", "online");
console.log("[launcher] dashboard http://127.0.0.1:3000");
console.log("[launcher] mcp       http://127.0.0.1:3333/mcp");

const interval = setInterval(() => {
  if (getSetting("shutdown_requested", "false") === "true") {
    clearInterval(interval);
    shutdown();
  }
}, 1_000);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    clearInterval(interval);
    shutdown();
  });
}
