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
const APP_DIR = path.join("assets", "dashboard-app");

const REQUIRED_SKILL_ENTRIES = [
  "SKILL.md",
  "scripts/vibe-with-dashboard.js",
  "scripts/dashboard-ensure.cjs",
  "scripts/live-dashboard-smoke.cjs",
  "scripts/runtime-deps.cjs",
  "references/WORKFLOW.md",
  "references/CODEX_HOOKS.md",
  "assets/rubber-duck/rubber-duck-2d5.png",
  "assets/rubber-duck/rubber-duck-2d5.webp",
  "agents/openai.yaml",
  `${APP_DIR}/package.json`,
  `${APP_DIR}/package-lock.json`,
  `${APP_DIR}/scripts/dashboard-ensure.cjs`,
  `${APP_DIR}/scripts/live-dashboard-smoke.cjs`,
  `${APP_DIR}/scripts/launcher.ts`,
  `${APP_DIR}/scripts/runtime-deps.cjs`,
  `${APP_DIR}/src/app/page.tsx`,
  `${APP_DIR}/src/components/dashboard/dashboard-app.tsx`,
  `${APP_DIR}/public/rubber-duck/rubber-duck-2d5.png`,
  `${APP_DIR}/public/rubber-duck/rubber-duck-2d5.webp`,
  `${APP_DIR}/next.config.ts`,
  `${APP_DIR}/tsconfig.json`,
];

const FORBIDDEN_SKILL_ROOT_ENTRIES = [
  "bin",
  "e2e",
  "public",
  "src",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "tsconfig.json",
  "vitest.config.ts",
  "playwright.config.ts",
  "postcss.config.mjs",
  "components.json",
];

const CANONICAL_COMPARE_ENTRIES = ["SKILL.md", "scripts", "references", "assets", "agents"];

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
    .filter(
      (entry) =>
        ![".next", "node_modules", "test-results", "next-env.d.ts"].includes(
          entry.name
        )
    )
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
  const relativeTarget = path.relative(ROOT, target);
  for (const entry of REQUIRED_SKILL_ENTRIES) {
    if (!exists(path.join(target, entry))) {
      failures.push(`${relativeTarget} is missing ${entry}`);
    }
  }

  for (const entry of FORBIDDEN_SKILL_ROOT_ENTRIES) {
    if (exists(path.join(target, entry))) {
      failures.push(`${relativeTarget} has old root-level runtime entry ${entry}`);
    }
  }

  const ensureScript = exists(path.join(target, "scripts", "dashboard-ensure.cjs"))
    ? fs.readFileSync(path.join(target, "scripts", "dashboard-ensure.cjs"), "utf8")
    : "";
  if (!ensureScript.includes("nodew.exe")) {
    failures.push(
      `${relativeTarget} dashboard ensure does not prefer nodew.exe for quiet Windows launch`
    );
  }
  if (!ensureScript.includes("VIBE_DASHBOARD_VISIBLE_CONSOLE")) {
    failures.push(
      `${relativeTarget} dashboard ensure is missing the explicit visible-console debug escape hatch`
    );
  }
  if (!ensureScript.includes("startLauncherWithHiddenWindowsProcess")) {
    failures.push(
      `${relativeTarget} dashboard ensure is missing the hidden Windows fallback`
    );
  }
  if (!ensureScript.includes("ShowWindow = 0")) {
    failures.push(`${relativeTarget} dashboard ensure is missing hidden-window flags`);
  }
}

for (const entry of CANONICAL_COMPARE_ENTRIES) {
  const canonical = path.join(CANONICAL_SKILL, entry);
  const mirror = path.join(ROOT, ".agents", "skills", SKILL_NAME, entry);
  if (!exists(canonical) || !exists(mirror)) continue;
  if (hashPath(canonical) !== hashPath(mirror)) {
    failures.push(`.agents/skills/${SKILL_NAME} is out of sync for ${entry}`);
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
