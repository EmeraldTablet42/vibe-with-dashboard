import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, beforeEach } from "vitest";

import {
  addActivity,
  addAgentCheckpoint,
  archiveActiveBoard,
  getDashboardSnapshot,
  getSetting,
  updateCard,
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
      cards: [
        { title: "Installer", summary: "GitHub URL install", priority: "high" },
        { title: "Archive flow", summary: "Clear finished board" },
      ],
    });

    snapshot = await getDashboardSnapshot();
    expect(snapshot.board.title).toBe("Ship public installer");
    expect(snapshot.goals).toHaveLength(1);
    expect(snapshot.cards.map((card) => card.title)).toContain("Installer");
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

    expect((await getDashboardSnapshot()).board.archiveReady).toBe(true);
    const result = archiveActiveBoard();
    expect(result.archived).toBe(true);

    const snapshot = await getDashboardSnapshot();
    expect(snapshot.board.isEmpty).toBe(true);
    expect(snapshot.cards).toHaveLength(0);
    expect(snapshot.archives).toHaveLength(1);
  });

  it("exposes Vibe with Dashboard launch settings without Run or Decision state", async () => {
    upsertSetting("dashboard_url", "http://127.0.0.1:3010");
    expect(getSetting("dashboard_url")).toBe("http://127.0.0.1:3010");

    const snapshot = await getDashboardSnapshot();
    expect(snapshot.launch.command).toBe("$vibe-with-dashboard <user task>");
    expect(snapshot.launch.dashboardUrl).toBe("http://127.0.0.1:3010");
    expect("runs" in snapshot).toBe(false);
    expect("decisions" in snapshot).toBe(false);
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
});
