const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const dbPath = path.join(root, ".dashboard", "e2e.sqlite");

for (const suffix of ["", "-shm", "-wal"]) {
  fs.rmSync(`${dbPath}${suffix}`, { force: true });
}

const nextBin =
  process.platform === "win32"
    ? path.join(root, "node_modules", ".bin", "next.cmd")
    : path.join(root, "node_modules", ".bin", "next");

const result = spawnSync(
  process.platform === "win32" ? "cmd.exe" : nextBin,
  process.platform === "win32"
    ? ["/c", nextBin, "start", "--hostname", "127.0.0.1", "--port", "3100"]
    : ["start", "--hostname", "127.0.0.1", "--port", "3100"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      DASHBOARD_DB_PATH: dbPath,
      VIBE_DASHBOARD_APP_ROOT: root,
      VIBE_DASHBOARD_PROJECT_ROOT: root,
    },
    windowsHide: true,
  }
);

process.exit(result.status || 0);
