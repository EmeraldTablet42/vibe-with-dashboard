#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SKILL_NAME = "vibe-with-dashboard";
const CANONICAL_SKILL = path.join(ROOT, "skills", SKILL_NAME);
const MIRROR_SKILL = path.join(ROOT, ".agents", "skills", SKILL_NAME);
const APP_DIR = path.join("assets", "dashboard-app");

const APP_ENTRIES = [
  "bin",
  "e2e",
  "public",
  "scripts",
  "src",
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
  "vitest.config.ts",
];

const SKILL_SCRIPT_ENTRIES = [
  ["bin/vibe-with-dashboard.js", "scripts/vibe-with-dashboard.js"],
  ["scripts/dashboard-ensure.cjs", "scripts/dashboard-ensure.cjs"],
  ["scripts/live-dashboard-smoke.cjs", "scripts/live-dashboard-smoke.cjs"],
  ["scripts/runtime-deps.cjs", "scripts/runtime-deps.cjs"],
];

const OLD_ROOT_RUNTIME_ENTRIES = [
  "bin",
  "e2e",
  "public",
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
  "next-env.d.ts",
  "package-lock.json",
  "package.json",
  "playwright.config.ts",
  "postcss.config.mjs",
  "skills-lock.json",
  "tsconfig.json",
  "vibe_with_dashboard.md",
  "vitest.config.ts",
];

const GENERATED_ENTRIES = [
  ".next",
  "node_modules",
  "coverage",
  "playwright-report",
  "test-results",
  "tsconfig.tsbuildinfo",
];

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function copyEntry(source, target) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.cpSync(source, target, {
      recursive: true,
      force: true,
      filter: (candidate) => !GENERATED_ENTRIES.includes(path.basename(candidate)),
    });
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function removeOldRootRuntime(skillRoot) {
  for (const entry of OLD_ROOT_RUNTIME_ENTRIES) {
    fs.rmSync(path.join(skillRoot, entry), {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
  for (const entry of GENERATED_ENTRIES) {
    fs.rmSync(path.join(skillRoot, entry), {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
}

function syncCanonicalSkill() {
  if (!exists(path.join(CANONICAL_SKILL, "SKILL.md"))) {
    throw new Error(`missing canonical SKILL.md in ${CANONICAL_SKILL}`);
  }

  removeOldRootRuntime(CANONICAL_SKILL);
  fs.rmSync(path.join(CANONICAL_SKILL, "scripts"), {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
  for (const dir of ["scripts", "references", "assets", "agents"]) {
    fs.mkdirSync(path.join(CANONICAL_SKILL, dir), { recursive: true });
  }

  for (const [sourceEntry, targetEntry] of SKILL_SCRIPT_ENTRIES) {
    const source = path.join(ROOT, sourceEntry);
    if (!exists(source)) throw new Error(`skill script source missing: ${sourceEntry}`);
    copyEntry(source, path.join(CANONICAL_SKILL, targetEntry));
  }

  const duckSource = path.join(ROOT, "public", "rubber-duck");
  if (!exists(duckSource)) throw new Error("rubber duck assets missing");
  fs.rmSync(path.join(CANONICAL_SKILL, "assets", "rubber-duck"), {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
  copyEntry(duckSource, path.join(CANONICAL_SKILL, "assets", "rubber-duck"));

  const appRoot = path.join(CANONICAL_SKILL, APP_DIR);
  for (const entry of APP_ENTRIES) {
    fs.rmSync(path.join(appRoot, entry), {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
  for (const entry of APP_ENTRIES) {
    const source = path.join(ROOT, entry);
    if (!exists(source)) throw new Error(`runtime app source missing: ${entry}`);
    copyEntry(source, path.join(appRoot, entry));
  }
}

function syncMirrorSkill() {
  fs.mkdirSync(MIRROR_SKILL, { recursive: true });
  removeOldRootRuntime(MIRROR_SKILL);
  for (const entry of ["SKILL.md", "scripts", "references", "agents"]) {
    fs.rmSync(path.join(MIRROR_SKILL, entry), {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
    copyEntry(path.join(CANONICAL_SKILL, entry), path.join(MIRROR_SKILL, entry));
  }

  fs.mkdirSync(path.join(MIRROR_SKILL, "assets"), { recursive: true });
  fs.rmSync(path.join(MIRROR_SKILL, "assets", "rubber-duck"), {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
  copyEntry(
    path.join(CANONICAL_SKILL, "assets", "rubber-duck"),
    path.join(MIRROR_SKILL, "assets", "rubber-duck")
  );

  const mirrorAppRoot = path.join(MIRROR_SKILL, APP_DIR);
  const canonicalAppRoot = path.join(CANONICAL_SKILL, APP_DIR);
  for (const entry of APP_ENTRIES) {
    fs.rmSync(path.join(mirrorAppRoot, entry), {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
    copyEntry(path.join(canonicalAppRoot, entry), path.join(mirrorAppRoot, entry));
  }
}

syncCanonicalSkill();
process.stdout.write("[sync-skill-runtime] synced skills/vibe-with-dashboard\n");
syncMirrorSkill();
process.stdout.write("[sync-skill-runtime] synced .agents/skills/vibe-with-dashboard\n");
