/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_BINS = ["next", "tsx"];
const REQUIRED_MODULES = [
  "next",
  "tsx",
  "react",
  "react-dom",
  "better-sqlite3",
  "drizzle-orm",
];
const MARKER_NAME = ".vibe-dashboard-deps.json";

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hashFile(hash, appRoot, relativePath) {
  const filePath = path.join(appRoot, relativePath);
  hash.update(`${relativePath}\0`);
  if (exists(filePath)) {
    hash.update(fs.readFileSync(filePath));
  }
  hash.update("\0");
}

function dependencyHash(appRoot) {
  const hash = createHash("sha256");
  hashFile(hash, appRoot, "package.json");
  hashFile(hash, appRoot, "package-lock.json");
  return hash.digest("hex");
}

function markerPath(appRoot) {
  return path.join(appRoot, "node_modules", MARKER_NAME);
}

function readMarker(appRoot) {
  try {
    return readJson(markerPath(appRoot));
  } catch {
    return null;
  }
}

function writeMarker(appRoot) {
  const nodeModules = path.join(appRoot, "node_modules");
  fs.mkdirSync(nodeModules, { recursive: true });
  fs.writeFileSync(
    markerPath(appRoot),
    `${JSON.stringify(
      {
        appRoot,
        dependencyHash: dependencyHash(appRoot),
        checkedAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`
  );
}

function parseVersion(version) {
  return String(version)
    .replace(/^v/, "")
    .split(".")
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

function requiredNodeVersion(appRoot) {
  const packageJson = readJson(path.join(appRoot, "package.json"));
  const range = packageJson.engines?.node || ">=20.0.0";
  const match = String(range).match(/>=\s*(\d+\.\d+\.\d+)/);
  return match ? match[1] : "20.0.0";
}

function assertNodeVersion(appRoot) {
  const required = requiredNodeVersion(appRoot);
  if (compareVersions(process.version, required) < 0) {
    throw new Error(
      `Node ${required} or newer is required; current version is ${process.version}`
    );
  }
}

function assertNpmAvailable() {
  const result = spawnSync(...npmCommand(["--version"]), {
    stdio: "ignore",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error("npm is required to install dashboard dependencies");
  }
}

function binPath(appRoot, binName) {
  const fileName = process.platform === "win32" ? `${binName}.cmd` : binName;
  return path.join(appRoot, "node_modules", ".bin", fileName);
}

function canResolveModule(appRoot, moduleName) {
  try {
    require.resolve(moduleName, { paths: [appRoot] });
    return true;
  } catch {
    return false;
  }
}

function dependencyStatus(appRoot) {
  const reasons = [];
  const nodeModules = path.join(appRoot, "node_modules");
  const marker = readMarker(appRoot);
  const expectedHash = dependencyHash(appRoot);

  if (!exists(path.join(appRoot, "package.json"))) {
    reasons.push("package.json is missing");
  }
  if (!exists(nodeModules)) {
    reasons.push("node_modules is missing");
  }
  for (const binName of REQUIRED_BINS) {
    if (!exists(binPath(appRoot, binName))) {
      reasons.push(`${binName} binary is missing`);
    }
  }
  for (const moduleName of REQUIRED_MODULES) {
    if (!canResolveModule(appRoot, moduleName)) {
      reasons.push(`${moduleName} module is missing`);
    }
  }
  if (marker && marker.dependencyHash !== expectedHash) {
    reasons.push("package manifest changed");
  }

  return {
    ok: reasons.length === 0,
    markerMissing: !marker,
    expectedHash,
    reasons,
  };
}

function npmCommand(args) {
  if (process.platform !== "win32") return ["npm", args];

  const npmCli = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js"
  );
  if (exists(npmCli)) return [process.execPath, [npmCli, ...args]];

  const npmCmd = path.join(path.dirname(process.execPath), "npm.cmd");
  if (exists(npmCmd)) return [npmCmd, args];

  return ["npm.cmd", args];
}

function runNpm(appRoot, args, log) {
  log?.(`running npm ${args.join(" ")}`);
  const [command, npmArgs] = npmCommand(args);
  return spawnSync(command, npmArgs, {
    cwd: appRoot,
    stdio: "inherit",
    windowsHide: true,
  });
}

function installDependencies(appRoot, log) {
  const hasLockfile = exists(path.join(appRoot, "package-lock.json"));
  if (hasLockfile) {
    const ci = runNpm(appRoot, ["ci"], log);
    if (ci.status === 0) {
      writeMarker(appRoot);
      return "npm ci";
    }
    log?.("npm ci failed; falling back to npm install");
  }

  const install = runNpm(appRoot, ["install"], log);
  if (install.status !== 0) {
    throw new Error("npm install failed");
  }
  writeMarker(appRoot);
  return "npm install";
}

function ensureRuntimeDependencies(appRoot, options = {}) {
  const log = options.log || (() => {});
  assertNodeVersion(appRoot);
  assertNpmAvailable();

  const status = dependencyStatus(appRoot);
  if (status.ok) {
    if (status.markerMissing) writeMarker(appRoot);
    log("dependencies ready");
    return { action: "reused", reasons: [] };
  }

  log(`dependencies need install: ${status.reasons.join("; ")}`);
  const installer = installDependencies(appRoot, log);
  return { action: "installed", installer, reasons: status.reasons };
}

module.exports = {
  REQUIRED_BINS,
  REQUIRED_MODULES,
  assertNodeVersion,
  compareVersions,
  dependencyHash,
  dependencyStatus,
  ensureRuntimeDependencies,
  installDependencies,
  markerPath,
  writeMarker,
};
