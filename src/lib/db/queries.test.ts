import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, beforeEach } from "vitest";

import {
  addActivity,
  addAgentCheckpoint,
  getDashboardSnapshot,
  getSetting,
  markDuckSuggestionRead,
  replaceDuckSuggestions,
  updateCard,
  updateCardsProgress,
  updateGoal,
  updateMilestone,
  upsertPlan,
  upsertSetting,
} from "@/lib/db/queries";
import { resetSeedDataForTests } from "@/lib/db/seed";

describe("vibe dashboard state", () => {
  beforeEach(() => {
    resetSeedDataForTests();
  });

  it("starts with an empty active board and creates plan-backed cards", async () => {
    let snapshot = await getDashboardSnapshot();
    expect(snapshot.appId).toBe("vibe-with-dashboard");
    expect(snapshot.board.isEmpty).toBe(true);
    expect(snapshot.goals).toHaveLength(0);
    expect(snapshot.cards).toHaveLength(0);

    upsertPlan({
      task: "Ship public installer",
      translations: {
        ko: {
          title: "공개 설치 도구 배포",
          summary: "한국어 계획 요약",
          task: "공개 설치 도구 배포",
        },
      },
      milestone: {
        translations: {
          ko: { title: "현재 작업", summary: "한국어 마일스톤 요약" },
        },
      },
      cards: [
        {
          title: "Installer",
          summary: "GitHub URL install",
          translations: {
            ko: { title: "설치 도구", summary: "GitHub URL 설치" },
          },
          priority: "high",
        },
        { title: "Archive flow", summary: "Clear finished board" },
      ],
    });

    snapshot = await getDashboardSnapshot();
    expect(snapshot.board.title).toBe("Ship public installer");
    expect(snapshot.goals).toHaveLength(1);
    expect(snapshot.board.translations.ko?.title).toBe("공개 설치 도구 배포");
    expect(snapshot.goals[0].translations.ko?.title).toBe("공개 설치 도구 배포");
    expect(snapshot.goals[0].milestones[0].translations.ko?.title).toBe(
      "현재 작업"
    );
    expect(snapshot.cards.map((card) => card.title)).toContain("Installer");
    expect(snapshot.cards[0].translations.ko?.title).toBe("설치 도구");
    expect(snapshot.activityEntries.some((entry) => entry.phase === "plan")).toBe(true);
  });

  it("stores phase-level activity and agent checkpoints", async () => {
    upsertPlan({ task: "Record activity" });
    const activity = addActivity({
      phase: "implement",
      task: "test-task",
      title: "구현 중",
      message: "activity insert 확인",
      metadata: { files: 2 },
    });

    const checkpointId = addAgentCheckpoint({
      agent: "codex",
      task: "test-task",
      status: "active",
      summary: "checkpoint 확인",
      payload: { phase: "implement" },
    });

    expect(activity?.id).toBeTruthy();
    expect(checkpointId).toBeTruthy();

    const snapshot = await getDashboardSnapshot();
    expect(
      snapshot.activityEntries.some((entry) => entry.title === "구현 중")
    ).toBe(true);
    expect(
      snapshot.agentCheckpoints.some(
        (checkpoint) => checkpoint.summary === "checkpoint 확인"
      )
    ).toBe(true);
  });

  it("imports detailed multi-milestone plans and updates card progress from agent activity", async () => {
    upsertPlan({
      task: "Build a small calculator",
      title: "Calculator smoke project",
      summary: "Use a temporary calculator app to prove dashboard reactivity.",
      replace: true,
      milestones: [
        {
          title: "Scaffold",
          summary: "Create temporary app files.",
          cards: [
            {
              title: "Create calculator shell",
              summary: "Add the minimal HTML, CSS, and JS structure.",
              status: "ready",
              priority: "high",
              acceptanceCriteria: "Calculator shell renders with display and keypad.",
            },
          ],
        },
        {
          title: "Verify",
          summary: "Exercise arithmetic and cleanup.",
          cards: [
            {
              title: "Run calculator checks",
              summary: "Confirm simple operations and remove temporary files.",
              status: "backlog",
              priority: "medium",
            },
          ],
        },
      ],
    });

    let snapshot = await getDashboardSnapshot();
    expect(snapshot.goals).toHaveLength(1);
    expect(snapshot.goals[0].milestones).toHaveLength(2);
    expect(snapshot.cards.map((card) => card.title)).toEqual([
      "Create calculator shell",
      "Run calculator checks",
    ]);
    expect(snapshot.cards[0].acceptanceCriteria).toContain("display");

    const updates = updateCardsProgress([
      { title: "Create calculator shell", status: "doing" },
    ]);
    expect(updates[0]).toMatchObject({ updated: true });

    snapshot = await getDashboardSnapshot();
    expect(
      snapshot.cards.find((card) => card.title === "Create calculator shell")
        ?.status
    ).toBe("doing");
    expect(snapshot.goals[0].milestones[0].status).toBe("active");
  });

  it("auto-archives when result activity and all cards are complete", async () => {
    upsertPlan({
      task: "Auto archive",
      replace: true,
      cards: [
        { title: "One", status: "ready" },
        { title: "Two", status: "ready" },
      ],
    });

    updateCardsProgress([
      { title: "One", status: "done" },
      { title: "Two", status: "done" },
    ]);
    addActivity({
      phase: "result",
      title: "Done",
      message: "All work finished",
      task: "auto-archive",
    });

    const snapshot = await getDashboardSnapshot();
    expect(snapshot.board.isEmpty).toBe(true);
    expect(snapshot.cards).toHaveLength(0);
    expect(snapshot.archives[0].title).toBe("Auto archive");
    expect(snapshot.archives[0].snapshot.cards).toHaveLength(2);
  });

  it("does not let old result activity auto-archive a replacement plan", async () => {
    upsertPlan({
      task: "Old work",
      replace: true,
      cards: [{ title: "Old card", status: "ready" }],
    });
    const old = await getDashboardSnapshot();
    updateCardsProgress([{ title: old.cards[0].title, status: "done" }]);
    addActivity({
      phase: "result",
      title: "Old done",
      message: "Old board archived",
    });

    upsertPlan({
      task: "Replacement work",
      replace: true,
      cards: [{ title: "Replacement card", status: "ready" }],
    });
    updateCardsProgress([{ title: "Replacement card", status: "done" }]);

    const snapshot = await getDashboardSnapshot();
    expect(snapshot.board.title).toBe("Replacement work");
    expect(snapshot.board.isEmpty).toBe(false);
    expect(snapshot.cards).toHaveLength(1);
    expect(snapshot.archives).toHaveLength(1);
  });

  it("archives when cards become done after result was already recorded", async () => {
    upsertPlan({
      task: "Late card completion",
      replace: true,
      cards: [{ title: "Finish after result", status: "ready" }],
    });
    addActivity({
      phase: "result",
      title: "Result first",
      message: "The result was recorded before the card moved.",
    });
    expect((await getDashboardSnapshot()).board.isEmpty).toBe(false);

    updateCardsProgress([{ title: "Finish after result", status: "done" }]);

    const snapshot = await getDashboardSnapshot();
    expect(snapshot.board.isEmpty).toBe(true);
    expect(snapshot.archives[0].title).toBe("Late card completion");
  });

  it("updates limited card, goal, and milestone fields", async () => {
    upsertPlan({ task: "Update board fields" });
    const initial = await getDashboardSnapshot();
    const cardId = initial.cards[0].id;
    const goalId = initial.goals[0].id;
    const milestoneId = initial.goals[0].milestones[0].id;

    updateCard(cardId, {
      status: "doing",
      priority: "low",
      position: 9,
    });
    updateGoal(goalId, { status: "paused" });
    updateMilestone(milestoneId, { status: "complete" });

    const snapshot = await getDashboardSnapshot();
    const card = snapshot.cards.find((item) => item.id === cardId);
    const goal = snapshot.goals.find((item) => item.id === goalId);
    const milestone = snapshot.goals
      .flatMap((item) => item.milestones)
      .find((item) => item.id === milestoneId);

    expect(card?.status).toBe("doing");
    expect(card?.priority).toBe("low");
    expect(goal?.status).toBe("paused");
    expect(milestone?.status).toBe("complete");
  });

  it("replaces, localizes, reads, clears, and archives duck suggestions", async () => {
    upsertPlan({ task: "Duck advice" });
    replaceDuckSuggestions({
      source: "test-agent",
      suggestions: [
        {
          keyword: "Tests",
          title: "Add coverage",
          summary: "Cover the new path.",
          detail: "A focused test protects the dashboard contract.",
          actionPrompt: "Add tests for this path.",
          priority: "high",
          translations: {
            ko: {
              keyword: "테스트",
              title: "커버리지 추가",
              summary: "새 경로를 검증한다.",
              detail: "집중 테스트로 대시보드 계약을 보호한다.",
              actionPrompt: "이 경로의 테스트를 추가해줘.",
            },
          },
        },
      ],
    });

    let snapshot = await getDashboardSnapshot();
    expect(snapshot.duckSuggestions).toHaveLength(1);
    expect(snapshot.duckSuggestions[0].readAt).toBeNull();
    expect(snapshot.duckSuggestions[0].translations.ko?.keyword).toBe("테스트");

    markDuckSuggestionRead(snapshot.duckSuggestions[0].id);
    snapshot = await getDashboardSnapshot();
    expect(snapshot.duckSuggestions[0].readAt).toBeTruthy();

    replaceDuckSuggestions({ suggestions: [] });
    snapshot = await getDashboardSnapshot();
    expect(snapshot.duckSuggestions).toHaveLength(0);

    replaceDuckSuggestions({
      suggestions: [
        {
          keyword: "Archive",
          title: "Preserve advice",
          priority: "medium",
        },
      ],
    });
    const planned = await getDashboardSnapshot();
    for (const card of planned.cards) {
      updateCard(card.id, { status: "done" });
    }
    addActivity({
      phase: "result",
      title: "Done",
      message: "Duck suggestions archived",
      task: "duck",
    });

    snapshot = await getDashboardSnapshot();
    expect(snapshot.duckSuggestions).toHaveLength(0);
    expect(snapshot.archives[0].snapshot.duckSuggestions).toHaveLength(1);
  });

  it("archives complete boards and clears the active board", async () => {
    upsertPlan({ task: "Archive this board" });
    const planned = await getDashboardSnapshot();
    for (const card of planned.cards) {
      updateCard(card.id, { status: "done" });
    }
    addActivity({
      phase: "result",
      title: "Done",
      message: "All cards complete",
      task: "archive",
    });

    const snapshot = await getDashboardSnapshot();
    expect(snapshot.board.isEmpty).toBe(true);
    expect(snapshot.cards).toHaveLength(0);
    expect(snapshot.archives).toHaveLength(1);
  });

  it("exposes Vibe with Dashboard launch settings without queue state", async () => {
    upsertSetting("dashboard_url", "http://127.0.0.1:3010");
    expect(getSetting("dashboard_url")).toBe("http://127.0.0.1:3010");

    const snapshot = await getDashboardSnapshot();
    expect(snapshot.launch.command).toBe("$vibe-with-dashboard <user task>");
    expect(snapshot.launch.dashboardUrl).toBe("http://127.0.0.1:3010");
    expect("queue" in snapshot).toBe(false);
  });
});

describe("installer CLI", () => {
  it("supports dry-run project install and provider selection", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-dashboard-"));
    const result = spawnSync(
      process.execPath,
      [
        "bin/vibe-with-dashboard.js",
        "install",
        "--dry-run",
        "--project",
        tempRoot,
        "--only",
        "codex",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        windowsHide: true,
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("dry run complete");
    expect(result.stdout).toContain("npx -y skills add EmeraldTablet42/vibe-with-dashboard");
    expect(fs.existsSync(path.join(tempRoot, ".agents"))).toBe(false);
  });

  it("posts suggestion payloads through the CLI", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-dashboard-cli-"));
    let payload = "";
    const server = http.createServer((request, response) => {
      request.on("data", (chunk) => {
        payload += chunk;
      });
      request.on("end", () => {
        response.writeHead(201, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("failed to start test server");
    }

    const result = await new Promise<{ status: number | null; stderr: string }>(
      (resolve) => {
        const child = spawn(
          process.execPath,
          [
            "bin/vibe-with-dashboard.js",
            "suggest",
            "--project",
            tempRoot,
            "--suggestion-json",
            JSON.stringify({
              keyword: "Tests",
              title: "Add tests",
              actionPrompt: "Write tests.",
            }),
          ],
          {
            cwd: process.cwd(),
            windowsHide: true,
            env: {
              ...process.env,
              DASHBOARD_URL: `http://127.0.0.1:${address.port}`,
            },
          }
        );
        let stderr = "";
        const timeout = setTimeout(() => {
          child.kill();
        }, 10_000);
        child.stderr.on("data", (chunk) => {
          stderr += String(chunk);
        });
        child.stdout.on("data", () => {
          // drain output
        });
        child.on("close", (status) => {
          clearTimeout(timeout);
          resolve({ status, stderr });
        });
      }
    );

    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(result.status).toBe(0);
    expect(JSON.parse(payload)).toMatchObject({
      suggestions: [
        {
          keyword: "Tests",
          title: "Add tests",
          actionPrompt: "Write tests.",
        },
      ],
    });
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("posts card progress payloads through the CLI", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-dashboard-card-"));
    let payload = "";
    const server = http.createServer((request, response) => {
      request.on("data", (chunk) => {
        payload += chunk;
      });
      request.on("end", () => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("failed to start test server");
    }

    const result = await new Promise<{ status: number | null; stderr: string }>(
      (resolve) => {
        const child = spawn(
          process.execPath,
          [
            "bin/vibe-with-dashboard.js",
            "card",
            "--project",
            tempRoot,
            "--card",
            "Create calculator shell",
            "--status",
            "done",
            "--priority",
            "high",
          ],
          {
            cwd: process.cwd(),
            windowsHide: true,
            env: {
              ...process.env,
              DASHBOARD_URL: `http://127.0.0.1:${address.port}`,
            },
          }
        );
        let stderr = "";
        const timeout = setTimeout(() => {
          child.kill();
        }, 10_000);
        child.stderr.on("data", (chunk) => {
          stderr += String(chunk);
        });
        child.stdout.on("data", () => {
          // drain output
        });
        child.on("close", (status) => {
          clearTimeout(timeout);
          resolve({ status, stderr });
        });
      }
    );

    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(result.status).toBe(0);
    expect(JSON.parse(payload)).toMatchObject({
      updates: [
        {
          title: "Create calculator shell",
          status: "done",
          priority: "high",
        },
      ],
    });
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});
