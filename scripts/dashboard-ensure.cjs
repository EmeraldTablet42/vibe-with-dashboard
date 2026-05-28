const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const root = process.cwd();
const host = "127.0.0.1";
const appId = "codex-dashboard";
const stateDir = path.join(root, ".dashboard");
const statePath = path.join(stateDir, "state.json");
const startPort = Number(process.env.DASHBOARD_PORT || process.env.PORT || 3000);
const maxPort = startPort + 40;

function log(message) {
  process.stdout.write(`[dashboard-ensure] ${message}\n`);
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

function normalize(filePath) {
  return path.resolve(filePath).toLowerCase();
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function ensureDependencies() {
  const tsxBin =
    process.platform === "win32"
      ? path.join(root, "node_modules", ".bin", "tsx.cmd")
      : path.join(root, "node_modules", ".bin", "tsx");
  const nextBin =
    process.platform === "win32"
      ? path.join(root, "node_modules", ".bin", "next.cmd")
      : path.join(root, "node_modules", ".bin", "next");

  if (exists(tsxBin) && exists(nextBin)) return;

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

function getHealth(port, timeoutMs = 4_000) {
  const url = `http://${host}:${port}/api/health`;

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const request = http.get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          const json = JSON.parse(body);
          settle({
            reachable: true,
            ok: Boolean(json.ok) && response.statusCode < 500,
            json,
          });
        } catch {
          settle({ reachable: true, ok: false, json: null });
        }
      });
    });

    request.on("error", () =>
      settle({ reachable: false, ok: false, json: null })
    );
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      settle({ reachable: false, ok: false, json: null });
    });
  });
}

function isPortOpen(port, timeoutMs = 600) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve(true);
    });
  });
}

function isSameDashboard(health) {
  return (
    health.ok &&
    health.json?.appId === appId &&
    normalize(health.json?.projectRoot || "") === normalize(root)
  );
}

function runPowerShell(script) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { cwd: root, encoding: "utf8", windowsHide: true }
  );
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

function getPortOwnerPid(port) {
  if (process.platform !== "win32") return null;
  const output = runPowerShell(
    `Get-NetTCPConnection -LocalAddress ${host} -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess`
  );
  const pid = Number(output);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function isProjectProcess(pid) {
  if (process.platform !== "win32") return false;
  const escapedRoot = root.replaceAll("'", "''");
  const commandLine = runPowerShell(
    `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`
  );
  return commandLine.toLowerCase().includes(escapedRoot.toLowerCase());
}

function stopProcessTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
      cwd: root,
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // already gone
  }
}

function writeState(port, pid, reused) {
  ensureDir(stateDir);
  const url = `http://${host}:${port}`;
  const state = {
    appId,
    projectRoot: root,
    port,
    url,
    pid: pid ?? null,
    reused,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

function openBrowser(url) {
  if (process.env.DASHBOARD_NO_BROWSER === "1") return;

  if (process.platform === "win32") {
    spawn("cmd.exe", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
    return;
  }

  const command = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(command, [url], { detached: true, stdio: "ignore" }).unref();
}

function startLauncher(port) {
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
    env: {
      ...process.env,
      DASHBOARD_PORT: String(port),
      PORT: String(port),
    },
    stdio: ["ignore", out, err],
    windowsHide: true,
  });

  fs.writeFileSync(path.join(stateDir, "launcher.pid"), String(child.pid));
  child.unref();
  log(`started launcher pid=${child.pid} port=${port}`);
  return child.pid;
}

async function waitForSameDashboard(port, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const health = await getHealth(port);
    if (isSameDashboard(health)) return health;
    await sleep(800);
  }

  return null;
}

async function findExistingDashboard() {
  const state = readState();
  if (state?.port) {
    const health = await getHealth(Number(state.port));
    if (isSameDashboard(health)) {
      return writeState(Number(state.port), state.pid ?? null, true);
    }
  }

  for (let port = startPort; port <= maxPort; port += 1) {
    const health = await getHealth(port);
    if (isSameDashboard(health)) {
      return writeState(port, null, true);
    }
  }

  return null;
}

async function chooseDashboard() {
  const existing = await findExistingDashboard();
  if (existing) return { ...existing, reason: "reused" };

  for (let port = startPort; port <= maxPort; port += 1) {
    const health = await getHealth(port);
    const occupied = health.reachable || (await isPortOpen(port));

    if (occupied) {
      const pid = getPortOwnerPid(port);
      if (pid && isProjectProcess(pid)) {
        log(`port ${port} has a stale project dashboard; stopping pid=${pid}`);
        stopProcessTree(pid);
        await sleep(1_200);
        port -= 1;
        continue;
      }

      log(`port ${port} is occupied by another service; trying next`);
      continue;
    }

    const pid = startLauncher(port);
    const ready = await waitForSameDashboard(port, 60_000);
    if (!ready) {
      stopProcessTree(pid);
      throw new Error(`dashboard started on ${port} but did not become healthy`);
    }

    const state = writeState(port, pid, false);
    return { ...state, reason: "started" };
  }

  throw new Error(`no available dashboard port in ${startPort}-${maxPort}`);
}

async function main() {
  ensureDir(stateDir);
  ensureDependencies();
  const state = await chooseDashboard();
  openBrowser(state.url);
  log(`dashboard ${state.reason}: ${state.url}`);
  process.stdout.write(`DASHBOARD_URL=${state.url}\n`);
}

main().catch((error) => {
  console.error(`[dashboard-ensure] ${error.message}`);
  process.exit(1);
});
