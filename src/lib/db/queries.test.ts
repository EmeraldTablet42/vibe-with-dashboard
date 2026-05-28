import { beforeEach, describe, expect, it } from "vitest";

import {
  addActivity,
  addAgentCheckpoint,
  getDashboardSnapshot,
  getSetting,
  updateCard,
  updateGoal,
  updateMilestone,
  upsertSetting,
} from "@/lib/db/queries";
import { resetSeedDataForTests } from "@/lib/db/seed";

describe("monitoring dashboard state", () => {
  beforeEach(() => {
    resetSeedDataForTests();
  });

  it("stores phase-level activity and agent checkpoints", async () => {
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
    updateCard("card-kanban-axis", {
      status: "doing",
      priority: "low",
      position: 9,
    });
    updateGoal("goal-monitoring-dashboard", { status: "paused" });
    updateMilestone("milestone-monitor", { status: "complete" });

    const snapshot = await getDashboardSnapshot();
    const card = snapshot.cards.find((item) => item.id === "card-kanban-axis");
    const goal = snapshot.goals.find(
      (item) => item.id === "goal-monitoring-dashboard"
    );
    const milestone = snapshot.goals
      .flatMap((item) => item.milestones)
      .find((item) => item.id === "milestone-monitor");

    expect(card?.status).toBe("doing");
    expect(card?.priority).toBe("low");
    expect(goal?.status).toBe("paused");
    expect(milestone?.status).toBe("complete");
  });

  it("exposes launch settings without Run or Decision state", async () => {
    upsertSetting("dashboard_url", "http://127.0.0.1:3010");
    expect(getSetting("dashboard_url")).toBe("http://127.0.0.1:3010");

    const snapshot = await getDashboardSnapshot();
    expect(snapshot.launch.command).toBe("$codex-dashboard <user task>");
    expect(snapshot.launch.dashboardUrl).toBe("http://127.0.0.1:3010");
    expect("runs" in snapshot).toBe(false);
    expect("decisions" in snapshot).toBe(false);
  });
});
