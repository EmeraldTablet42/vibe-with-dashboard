import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

describe("dashboard database safety", () => {
  it("refuses to initialize an unrelated non-empty SQLite database", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-db-safety-"));
    const dbPath = path.join(tempRoot, ".dashboard", "foreign.sqlite");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const foreign = new Database(dbPath);
    foreign.exec("CREATE TABLE unrelated (id TEXT PRIMARY KEY);");
    foreign.close();

    const previousDbPath = process.env.DASHBOARD_DB_PATH;
    const previousProjectRoot = process.env.VIBE_DASHBOARD_PROJECT_ROOT;
    process.env.VIBE_DASHBOARD_PROJECT_ROOT = tempRoot;
    process.env.DASHBOARD_DB_PATH = dbPath;
    vi.resetModules();
    try {
      const { closeDatabaseForTests, initializeDatabase } = await import(
        "@/lib/db/client"
      );
      expect(() => initializeDatabase()).toThrow(/Refusing to initialize unknown SQLite database/);
      closeDatabaseForTests();
      const verify = new Database(dbPath);
      expect(
        verify
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'unrelated'")
          .get()
      ).toBeTruthy();
      verify.close();
    } finally {
      if (previousDbPath) {
        process.env.DASHBOARD_DB_PATH = previousDbPath;
      } else {
        delete process.env.DASHBOARD_DB_PATH;
      }
      if (previousProjectRoot) {
        process.env.VIBE_DASHBOARD_PROJECT_ROOT = previousProjectRoot;
      } else {
        delete process.env.VIBE_DASHBOARD_PROJECT_ROOT;
      }
      const client = await import("@/lib/db/client");
      client.closeDatabaseForTests();
      vi.resetModules();
      fs.rmSync(tempRoot, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
    }
  });

  it("rejects empty DB paths outside the target project dashboard dir", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-db-scope-"));
    const outsidePath = path.join(os.tmpdir(), `outside-${Date.now()}.sqlite`);
    const previousDbPath = process.env.DASHBOARD_DB_PATH;
    const previousProjectRoot = process.env.VIBE_DASHBOARD_PROJECT_ROOT;
    process.env.VIBE_DASHBOARD_PROJECT_ROOT = tempRoot;
    process.env.DASHBOARD_DB_PATH = outsidePath;
    vi.resetModules();
    try {
      const { initializeDatabase } = await import("@/lib/db/client");
      expect(() => initializeDatabase()).toThrow(/DASHBOARD_DB_PATH must stay inside/);
      expect(fs.existsSync(outsidePath)).toBe(false);
    } finally {
      if (previousDbPath) {
        process.env.DASHBOARD_DB_PATH = previousDbPath;
      } else {
        delete process.env.DASHBOARD_DB_PATH;
      }
      if (previousProjectRoot) {
        process.env.VIBE_DASHBOARD_PROJECT_ROOT = previousProjectRoot;
      } else {
        delete process.env.VIBE_DASHBOARD_PROJECT_ROOT;
      }
      const client = await import("@/lib/db/client");
      client.closeDatabaseForTests();
      vi.resetModules();
      fs.rmSync(tempRoot, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
      fs.rmSync(outsidePath, { force: true });
    }
  });
});
