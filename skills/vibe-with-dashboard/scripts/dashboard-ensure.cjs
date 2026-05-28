const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const { ensureRuntimeDependencies } = require("./runtime-deps.cjs");

const projectRoot = path.resolve(
  process.env.VIBE_DASHBOARD_PROJECT_ROOT || process.cwd()
);
const appRoot = path.resolve(
  process.env.VIBE_DASHBOARD_APP_ROOT || path.join(__dirname, "..")
);
const host = "127.0.0.1";
const appId = "vibe-with-dashboard";
const stateDir = path.join(projectRoot, ".dashboard");
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
  ensureRuntimeDependencies(appRoot, { log });
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
    normalize(health.json?.projectRoot || "") === normalize(projectRoot)
  );
}

function isSameRuntime(health) {
  return normalize(health.json?.appRoot || "") === normalize(appRoot);
}

function wantsDevMode() {
  return (
    process.env.VIBE_DASHBOARD_PROD !== "1" &&
    process.env.VIBE_DASHBOARD_DEV !== "0"
  );
}

function isReusableDashboard(health) {
  if (!isSameDashboard(health)) return false;
  if (!isSameRuntime(health)) return false;
  return wantsDevMode()
    ? health.json?.mode === "development"
    : health.json?.mode !== "development";
}

function runPowerShell(script) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { cwd: projectRoot, encoding: "utf8", windowsHide: true }
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

function isDashboardProcess(pid) {
  if (process.platform !== "win32") return false;
  const commandLine = runPowerShell(
    `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`
  );
  const lower = commandLine.toLowerCase();
  return (
    (lower.includes(appRoot.toLowerCase()) ||
      lower.includes(projectRoot.toLowerCase())) &&
    (lower.includes("vibe-with-dashboard") ||
      lower.includes(".vibe-with-dashboard") ||
      lower.includes("dashboard"))
  );
}

function stopProcessTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
      cwd: projectRoot,
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

function statePidForPort(port) {
  const state = readState();
  if (Number(state?.port) !== port) return null;
  const pid = Number(state?.pid);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function writeState(port, pid, reused) {
  ensureDir(stateDir);
  const url = `http://${host}:${port}`;
  const state = {
    appId,
    projectRoot,
    appRoot,
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
    spawn("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-WindowStyle",
      "Hidden",
      "-Command",
      "Start-Process",
      url,
    ], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
    return;
  }

  const command = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(command, [url], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
}

function resolveFromAppRoot(specifier) {
  return require.resolve(specifier, { paths: [appRoot] });
}

function startLauncher(port) {
  ensureDir(stateDir);
  const out = fs.openSync(path.join(stateDir, "launcher.out.log"), "a");
  const err = fs.openSync(path.join(stateDir, "launcher.err.log"), "a");
  const command = process.execPath;
  const args = [resolveFromAppRoot("tsx/cli"), path.join(appRoot, "scripts", "launcher.ts")];

  const child = spawn(command, args, {
    cwd: appRoot,
    detached: true,
    env: {
      ...process.env,
      DASHBOARD_PORT: String(port),
      PORT: String(port),
      VIBE_DASHBOARD_APP_ROOT: appRoot,
      VIBE_DASHBOARD_PROJECT_ROOT: projectRoot,
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
    if (isReusableDashboard(health)) {
      return writeState(Number(state.port), state.pid ?? null, true);
    }
  }

  for (let port = startPort; port <= maxPort; port += 1) {
    const health = await getHealth(port);
    if (isReusableDashboard(health)) {
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
      if (isSameDashboard(health) && !isReusableDashboard(health)) {
        const ownerPid = getPortOwnerPid(port);
        const launcherPid = statePidForPort(port);
        const stalePid = ownerPid || launcherPid;
        if (stalePid) {
          log(`port ${port} has project dashboard in the wrong mode or runtime; stopping pid=${stalePid}`);
          stopProcessTree(stalePid);
          if (launcherPid && launcherPid !== stalePid) stopProcessTree(launcherPid);
          await sleep(1_200);
          port -= 1;
          continue;
        }
      }

      const pid = getPortOwnerPid(port);
      if (pid && isDashboardProcess(pid)) {
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
    const ready = await waitForSameDashboard(port, 180_000);
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
