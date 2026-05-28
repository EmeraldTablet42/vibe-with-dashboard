const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const root = process.cwd();
const stateDir = path.join(root, ".dashboard");
const dashboardUrl = "http://127.0.0.1:3000";
const healthUrl = `${dashboardUrl}/api/health`;
const mcpHost = "127.0.0.1";
const mcpPort = 3333;

function log(message) {
  process.stdout.write(`[goal-bootstrap] ${message}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function ensureDependencies() {
  const tsxBin =
    process.platform === "win32"
      ? path.join(root, "node_modules", ".bin", "tsx.cmd")
      : path.join(root, "node_modules", ".bin", "tsx");

  if (exists(tsxBin)) return;

  log("dependencies missing; running npm install");
  const result = spawnSync("npm", ["install"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error("npm install failed");
  }
}

function ensureProjectConfig() {
  const example = path.join(root, ".codex", "config.example.toml");
  const local = path.join(root, ".codex", "config.toml");

  if (!exists(local) && exists(example)) {
    fs.copyFileSync(example, local);
    log("created .codex/config.toml from example");
  }
}

function waitForHttp(url, timeoutMs) {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve(true);
        } else if (Date.now() - startedAt > timeoutMs) {
          resolve(false);
        } else {
          setTimeout(attempt, 800);
        }
      });

      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          resolve(false);
        } else {
          setTimeout(attempt, 800);
        }
      });
      request.setTimeout(8_000, () => request.destroy());
    };

    attempt();
  });
}

function waitForPort(host, port, timeoutMs) {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const attempt = () => {
      const socket = net.createConnection({ host, port });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt > timeoutMs) {
          resolve(false);
        } else {
          setTimeout(attempt, 800);
        }
      });
      socket.setTimeout(1_500, () => socket.destroy());
    };

    attempt();
  });
}

function stopStaleProjectServices() {
  if (process.platform !== "win32") return;

  const patterns = [
    "npm run dashboard",
    "scripts/launcher.ts",
    "scripts\\\\launcher.ts",
    "scripts/mcp-server.ts",
    "scripts\\\\mcp-server.ts",
    "next\\\\dist\\\\bin\\\\next",
    "next/dist/bin/next",
    "next\\\\dist\\\\server\\\\lib\\\\start-server.js",
    ".next\\\\dev\\\\build\\\\postcss.js",
    "@esbuild\\\\win32-x64\\\\esbuild.exe",
  ];

  const ps = `
$workspace = ${JSON.stringify(root)}
$current = ${process.pid}
$patterns = @(${patterns.map((pattern) => JSON.stringify(pattern)).join(", ")})
Get-CimInstance Win32_Process | Where-Object {
  $cmd = $_.CommandLine
  if (-not $cmd) { return $false }
  if ($_.ProcessId -eq $PID -or $_.ProcessId -eq $current) { return $false }
  if ($cmd -notlike "*$workspace*") { return $false }
  foreach ($pattern in $patterns) {
    if ($cmd -like "*$pattern*") { return $true }
  }
  return $false
} | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  Write-Output "stopped $($_.ProcessId) $($_.Name)"
}
`;

  const encoded = Buffer.from(ps, "utf16le").toString("base64");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
    { cwd: root, encoding: "utf8", windowsHide: true }
  );

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (output) log(output.replace(/\r?\n/g, "; "));
}

function startLauncher() {
  ensureDir(stateDir);
  const out = fs.openSync(path.join(stateDir, "launcher.out.log"), "a");
  const err = fs.openSync(path.join(stateDir, "launcher.err.log"), "a");
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args =
    process.platform === "win32"
      ? ["/c", "npm", "run", "dashboard"]
      : ["run", "dashboard"];

  const child = spawn(command, args, {
    cwd: root,
    detached: true,
    env: process.env,
    stdio: ["ignore", out, err],
    windowsHide: true,
  });

  fs.writeFileSync(path.join(stateDir, "launcher.pid"), String(child.pid));
  child.unref();
  log(`started dashboard launcher pid=${child.pid}`);
}

async function main() {
  ensureDir(stateDir);
  ensureDependencies();
  ensureProjectConfig();

  let dashboardReady = await waitForHttp(healthUrl, 2_500);
  let mcpReady = await waitForPort(mcpHost, mcpPort, 1_500);

  if (!dashboardReady || !mcpReady) {
    const portBusy =
      (await waitForPort(mcpHost, 3000, 500)) ||
      (await waitForPort(mcpHost, mcpPort, 500));

    if (portBusy) {
      dashboardReady = await waitForHttp(healthUrl, 15_000);
      mcpReady = await waitForPort(mcpHost, mcpPort, 2_000);
      if (!dashboardReady || !mcpReady) {
        log("existing project services are not healthy; stopping stale processes");
        stopStaleProjectServices();
        await sleep(1_200);
      }
    }

    if (!dashboardReady || !mcpReady) {
      startLauncher();
      dashboardReady = await waitForHttp(healthUrl, 60_000);
      mcpReady = await waitForPort(mcpHost, mcpPort, 45_000);
    }
  }

  if (!dashboardReady) {
    throw new Error(`dashboard not ready: ${healthUrl}`);
  }
  if (!mcpReady) {
    throw new Error(`MCP not ready: ${mcpHost}:${mcpPort}`);
  }

  log(`dashboard ready ${dashboardUrl}`);
  log(`mcp ready http://${mcpHost}:${mcpPort}/mcp`);
  log("next: use project-dashboard-agent skill and keep heartbeat loop alive");
}

main().catch((error) => {
  console.error(`[goal-bootstrap] ${error.message}`);
  process.exit(1);
});
