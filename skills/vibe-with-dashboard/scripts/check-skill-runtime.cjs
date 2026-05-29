#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SKILL_NAME = "vibe-with-dashboard";
const CANONICAL_SKILL = path.join(ROOT, "skills", SKILL_NAME);
const TARGETS = [
  CANONICAL_SKILL,
  path.join(ROOT, ".agents", "skills", SKILL_NAME),
];

const REQUIRED_ENTRIES = [
  "SKILL.md",
  "package.json",
  "package-lock.json",
  "bin/vibe-with-dashboard.js",
  "scripts/dashboard-ensure.cjs",
  "scripts/live-dashboard-smoke.cjs",
  "scripts/launcher.ts",
  "scripts/runtime-deps.cjs",
  "src/app/page.tsx",
  "src/components/dashboard/dashboard-app.tsx",
  "public/rubber-duck/rubber-duck-2d5.png",
  "public/rubber-duck/rubber-duck-2d5.webp",
  "next.config.ts",
  "tsconfig.json",
];

const SYNCED_ENTRIES = [
  "bin",
  "e2e",
  "public",
  "scripts",
  "src",
  "AGENTS.md",
  "CLAUDE.md",
  "CONTEXT.md",
  "GEMINI.md",
  "INSTALL.md",
  "LICENSE",
  "README.md",
  "components.json",
  "drizzle.config.ts",
  "eslint.config.mjs",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "playwright.config.ts",
  "postcss.config.mjs",
  "skills-lock.json",
  "tsconfig.json",
  "vibe_with_dashboard.md",
  "vitest.config.ts",
];

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function hashPath(filePath) {
  const hash = createHash("sha256");
  const stat = fs.statSync(filePath);
  if (!stat.isDirectory()) {
    hash.update(fs.readFileSync(filePath));
    return hash.digest("hex");
  }

  const entries = fs
    .readdirSync(filePath, { withFileTypes: true })
    .filter((entry) => ![".next", "node_modules", "test-results"].includes(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const child = path.join(filePath, entry.name);
    hash.update(entry.name);
    hash.update(hashPath(child));
  }
  return hash.digest("hex");
}

const failures = [];

for (const target of TARGETS) {
  for (const entry of REQUIRED_ENTRIES) {
    if (!exists(path.join(target, entry))) {
      failures.push(`${path.relative(ROOT, target)} is missing ${entry}`);
    }
  }

  for (const entry of SYNCED_ENTRIES) {
    const source = path.join(ROOT, entry);
    const copy = path.join(target, entry);
    if (!exists(copy)) {
      failures.push(`${path.relative(ROOT, target)} is missing synced ${entry}`);
      continue;
    }
    const sourceHash = hashPath(source);
    const copyHash = hashPath(copy);
    if (sourceHash !== copyHash) {
      failures.push(`${path.relative(ROOT, target)} is out of sync for ${entry}`);
    }
  }

  if (path.resolve(target) !== path.resolve(CANONICAL_SKILL)) {
    const sourceHash = hashPath(path.join(CANONICAL_SKILL, "SKILL.md"));
    const copyHash = hashPath(path.join(target, "SKILL.md"));
    if (sourceHash !== copyHash) {
      failures.push(`${path.relative(ROOT, target)} is out of sync for SKILL.md`);
    }
  }

  const ensureScript = fs.readFileSync(
    path.join(target, "scripts", "dashboard-ensure.cjs"),
    "utf8"
  );
  if (!ensureScript.includes("nodew.exe")) {
    failures.push(
      `${path.relative(ROOT, target)} dashboard ensure does not prefer nodew.exe for quiet Windows launch`
    );
  }
  if (!ensureScript.includes("VIBE_DASHBOARD_VISIBLE_CONSOLE")) {
    failures.push(
      `${path.relative(ROOT, target)} dashboard ensure is missing the explicit visible-console debug escape hatch`
    );
  }
  if (!ensureScript.includes("shouldDetachLauncher(command)")) {
    failures.push(
      `${path.relative(ROOT, target)} dashboard ensure does not guard Windows node.exe against detached console windows`
    );
  }
  if (!ensureScript.includes("startLauncherWithHiddenWindowsProcess")) {
    failures.push(
      `${path.relative(ROOT, target)} dashboard ensure is missing the hidden Windows launch fallback for Windows without nodew.exe`
    );
  }
  if (
    !ensureScript.includes("-WindowStyle") ||
    !ensureScript.includes("ShowWindow = 0")
  ) {
    failures.push(
      `${path.relative(ROOT, target)} dashboard ensure is missing hidden window flags for Windows background launch`
    );
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`[check-skill-runtime] ${failure}\n`);
  }
  process.stderr.write("[check-skill-runtime] run npm run runtime:sync\n");
  process.exit(1);
}

process.stdout.write("[check-skill-runtime] skill runtime copies are in sync\n");
