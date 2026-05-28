import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const runtimeDeps = require("../../scripts/runtime-deps.cjs") as {
  compareVersions: (left: string, right: string) => number;
  dependencyStatus: (appRoot: string) => { ok: boolean; markerMissing: boolean; reasons: string[] };
  writeMarker: (appRoot: string) => void;
};

function makeRuntimeFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "vibe-runtime-"));
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ engines: { node: ">=20.0.0" } }, null, 2)
  );
  writeFileSync(path.join(root, "package-lock.json"), "{}\n");
  mkdirSync(path.join(root, "node_modules", ".bin"), { recursive: true });
  for (const binName of ["next", "tsx"]) {
    const fileName = process.platform === "win32" ? `${binName}.cmd` : binName;
    writeFileSync(path.join(root, "node_modules", ".bin", fileName), "");
  }
  for (const moduleName of [
    "next",
    "tsx",
    "react",
    "react-dom",
    "better-sqlite3",
    "drizzle-orm",
  ]) {
    const moduleDir = path.join(root, "node_modules", moduleName);
    mkdirSync(moduleDir, { recursive: true });
    writeFileSync(path.join(moduleDir, "index.js"), "module.exports = {};\n");
  }
  return root;
}

describe("runtime dependency checks", () => {
  it("accepts compatible installed dependencies and writes a marker", () => {
    const root = makeRuntimeFixture();
    const before = runtimeDeps.dependencyStatus(root);
    expect(before.ok).toBe(true);
    expect(before.markerMissing).toBe(true);

    runtimeDeps.writeMarker(root);
    const after = runtimeDeps.dependencyStatus(root);
    expect(after.ok).toBe(true);
    expect(after.markerMissing).toBe(false);
  });

  it("detects package hash drift after the marker is written", () => {
    const root = makeRuntimeFixture();
    runtimeDeps.writeMarker(root);

    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ engines: { node: ">=20.0.0" }, dependencies: { react: "19.0.0" } })
    );

    const status = runtimeDeps.dependencyStatus(root);
    expect(status.ok).toBe(false);
    expect(status.reasons).toContain("package manifest changed");
  });

  it("uses semantic ordering for node versions", () => {
    expect(runtimeDeps.compareVersions("v20.10.0", "20.0.0")).toBe(1);
    expect(runtimeDeps.compareVersions("20.0.0", "20.0.0")).toBe(0);
    expect(runtimeDeps.compareVersions("18.19.0", "20.0.0")).toBe(-1);
  });
});

describe("skill-root installer", () => {
  it("prints project skill runtime actions during dry-run install", () => {
    const project = mkdtempSync(path.join(tmpdir(), "vibe-install-"));
    const result = spawnSync(
      process.execPath,
      ["bin/vibe-with-dashboard.js", "install", "--dry-run", "--project", project],
      {
        cwd: repoRoot,
        encoding: "utf8",
        windowsHide: true,
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("project skill runtime");
    expect(result.stdout).toContain(path.join(".agents", "skills", "vibe-with-dashboard"));
    expect(result.stdout).not.toContain(path.join(".vibe-with-dashboard", "app"));
  });
});
