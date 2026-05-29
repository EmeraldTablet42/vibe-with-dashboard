#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { chromium } = require("@playwright/test");

const DEFAULT_TIMEOUT = 15_000;

function parseArgs(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    const value = !next || next.startsWith("--") ? true : next;
    if (value !== true) index += 1;
    flags[key] = value;
  }
  return flags;
}

function readStateUrl(projectRoot) {
  try {
    const statePath = path.join(projectRoot, ".dashboard", "state.json");
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return state.url || "";
  } catch {
    return "";
  }
}

function defaultAppRoot() {
  const scriptRoot = path.resolve(__dirname, "..");
  const nestedAppRoot = path.join(scriptRoot, "assets", "dashboard-app");
  if (fs.existsSync(path.join(nestedAppRoot, "package.json"))) {
    return nestedAppRoot;
  }
  return scriptRoot;
}

function normalizePath(filePath = "") {
  if (!filePath) return "";
  return path.resolve(String(filePath)).toLowerCase();
}

async function readHealth(url) {
  const response = await fetch(new URL("/api/health", url));
  if (!response.ok) {
    throw new Error(`health check failed: HTTP ${response.status}`);
  }
  const health = await response.json();
  if (health.appId !== "vibe-with-dashboard") {
    throw new Error(`unexpected appId: ${health.appId || "(missing)"}`);
  }
  return health;
}

function assertHealthTarget(health, projectRoot, appRoot) {
  if (normalizePath(health.projectRoot) !== normalizePath(projectRoot)) {
    throw new Error(
      `projectRoot mismatch: expected ${projectRoot}, got ${health.projectRoot || "(missing)"}`
    );
  }

  if (
    health.appRoot &&
    normalizePath(health.appRoot) !== normalizePath(appRoot)
  ) {
    throw new Error(
      `appRoot mismatch: expected ${appRoot}, got ${health.appRoot}`
    );
  }
}

async function expectVisible(locator, label, timeout) {
  await locator.first().waitFor({ state: "visible", timeout });
  return locator.first();
}

async function visibleCount(locator) {
  const count = await locator.count();
  let visible = 0;
  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible()) visible += 1;
  }
  return visible;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(String(flags.project || process.cwd()));
  const appRoot = path.resolve(
    String(flags["app-root"] || process.env.VIBE_DASHBOARD_APP_ROOT || defaultAppRoot())
  );
  const timeout = Number(flags.timeout || DEFAULT_TIMEOUT);
  const url =
    String(flags.url || process.env.DASHBOARD_URL || readStateUrl(projectRoot)) ||
    "http://127.0.0.1:3000";

  const health = await readHealth(url);
  assertHealthTarget(health, projectRoot, appRoot);
  const browser = await chromium.launch({ headless: !flags.headful });
  const page = await browser.newPage({
    locale: String(flags.locale || "en-US"),
  });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });

    const focus = await expectVisible(
      page.getByTestId("current-focus-card"),
      "active focus card",
      timeout
    );
    const activeFocus = await focus.getAttribute("data-active-focus");
    if (activeFocus !== "true") {
      throw new Error("active focus card is not marked as active");
    }

    const planDoing = page.locator(
      '[data-card-plan-status="doing"][data-active-card="true"]'
    );
    const kanbanDoing = page.locator(
      '[data-testid="kanban-card"][data-card-status="doing"]'
    );
    await expectVisible(planDoing, "Plan doing card", timeout);
    await expectVisible(kanbanDoing, "Kanban doing card", timeout);

    const planDoingCount = await visibleCount(planDoing);
    const kanbanDoingCount = await visibleCount(kanbanDoing);
    if (planDoingCount !== 1 || kanbanDoingCount !== 1) {
      throw new Error(
        `expected exactly one visible doing card, got Plan=${planDoingCount}, Kanban=${kanbanDoingCount}`
      );
    }

    const allowIdleDuck = Boolean(flags["allow-idle-duck"]);
    let chips = page.getByTestId("duck-suggestion-chip");
    if ((await visibleCount(chips)) === 0) {
      const minimized = page.getByTestId("rubber-duck-minimized");
      if ((await visibleCount(minimized)) > 0) {
        await minimized.first().click();
      }
      chips = page.getByTestId("duck-suggestion-chip");
      if ((await visibleCount(chips)) === 0) {
        const duckButton = page.locator('[data-testid="rubber-duck"] .duck-quack');
        await expectVisible(duckButton, "Rubber Duck button", timeout);
        await duckButton.first().click();
      }
    }

    let chipCount = await visibleCount(chips);
    if (chipCount === 0 && allowIdleDuck) {
      await expectVisible(page.getByTestId("duck-idle-chip"), "Rubber Duck idle state", timeout);
    } else {
      await expectVisible(chips, "Rubber Duck suggestion chip", timeout);
      chipCount = await visibleCount(chips);
      if (chipCount < 1 || chipCount > 5) {
        throw new Error(`expected 1-5 Rubber Duck chips, got ${chipCount}`);
      }
    }

    const progress = await page
      .getByTestId("work-progress-bar")
      .getAttribute("data-work-progress");
    const focusText = (await focus.innerText()).replace(/\s+/g, " ").trim();
    const chipLabels = chipCount > 0
      ? (await chips.allInnerTexts()).map((text) => text.trim())
      : ["(idle)"];

    if (flags["strict-console"] && consoleErrors.length > 0) {
      throw new Error(`browser console errors: ${consoleErrors.join(" | ")}`);
    }

    const lines = [
        `[live-dashboard-smoke] ok ${url}`,
        `[live-dashboard-smoke] appRoot ${health.appRoot || "(unknown)"}`,
        `[live-dashboard-smoke] progress ${progress ?? "(unknown)"}%`,
        `[live-dashboard-smoke] focus ${focusText}`,
        `[live-dashboard-smoke] duck chips ${chipLabels.join(", ")}`,
    ];
    if (consoleErrors.length > 0) {
      lines.push(`[live-dashboard-smoke] console warnings ${consoleErrors.length}`);
    }
    process.stdout.write(lines.join("\n") + "\n");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`[live-dashboard-smoke] ${error.message}\n`);
  process.exit(1);
});
