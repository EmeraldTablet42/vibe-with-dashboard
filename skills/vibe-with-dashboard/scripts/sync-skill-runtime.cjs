#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SKILL_NAME = "vibe-with-dashboard";
const CANONICAL_SKILL = path.join(ROOT, "skills", SKILL_NAME);
const TARGETS = [
  CANONICAL_SKILL,
  path.join(ROOT, ".agents", "skills", SKILL_NAME),
];

const RUNTIME_ENTRIES = [
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

const REMOVE_BEFORE_COPY = [
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

function copyEntry(source, target) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.cpSync(source, target, {
      recursive: true,
      force: true,
      filter: (candidate) => {
        const name = path.basename(candidate);
        return ![
          ".dashboard",
          ".next",
          ".vibe-with-dashboard",
          "coverage",
          "node_modules",
          "playwright-report",
          "test-results",
          "tsconfig.tsbuildinfo",
        ].includes(name);
      },
    });
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function syncTarget(target) {
  fs.mkdirSync(target, { recursive: true });
  if (!exists(path.join(CANONICAL_SKILL, "SKILL.md"))) {
    throw new Error(`missing canonical SKILL.md in ${CANONICAL_SKILL}`);
  }

  for (const entry of REMOVE_BEFORE_COPY) {
    fs.rmSync(path.join(target, entry), { recursive: true, force: true });
  }

  for (const entry of RUNTIME_ENTRIES) {
    const source = path.join(ROOT, entry);
    if (!exists(source)) {
      throw new Error(`runtime source missing: ${entry}`);
    }
    copyEntry(source, path.join(target, entry));
  }

  if (path.resolve(target) !== path.resolve(CANONICAL_SKILL)) {
    fs.copyFileSync(
      path.join(CANONICAL_SKILL, "SKILL.md"),
      path.join(target, "SKILL.md")
    );
  }
}

for (const target of TARGETS) {
  syncTarget(target);
  process.stdout.write(`[sync-skill-runtime] synced ${path.relative(ROOT, target)}\n`);
}
