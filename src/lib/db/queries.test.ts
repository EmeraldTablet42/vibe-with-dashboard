import { beforeEach, describe, expect, it } from "vitest";

import {
  completeRun,
  createRun,
  getDashboardSnapshot,
  getSetting,
  heartbeat,
  moveCard,
  pollNextRun,
  reportProgress,
  requestDecision,
  requestShutdown,
} from "@/lib/db/queries";
import { resetSeedDataForTests } from "@/lib/db/seed";

describe("dashboard state machine", () => {
  beforeEach(() => {
    resetSeedDataForTests();
  });

  it("creates a queued Run and lets Codex claim then complete it", async () => {
    const run = createRun({
      prompt: "테스트 Run을 수행해줘",
      mode: "standard",
      riskLevel: "low",
    });

    expect(run?.status).toBe("queued");

    const claimed = pollNextRun("test-session");
    expect(claimed.shutdownRequested).toBe(false);
    expect(claimed.run?.id).toBe("run-first-handshake");
    expect(claimed.run?.status).toBe("running");

    const nextClaimed = pollNextRun("test-session");
    expect(nextClaimed.run?.id).toBe(run?.id);

    reportProgress({
      runId: run?.id,
      title: "검증 중",
      message: "progress event",
    });
    const completed = completeRun({
      runId: run!.id,
      result: "done",
    });

    expect(completed?.status).toBe("completed");

    const snapshot = await getDashboardSnapshot();
    expect(snapshot.events.some((event) => event.title === "검증 중")).toBe(true);
  });

  it("moves approval-gated Runs into waiting_approval", async () => {
    const run = createRun({
      prompt: "commit 해도 되는지 확인해줘",
      mode: "long",
      riskLevel: "normal",
    });

    const decision = requestDecision({
      runId: run?.id,
      title: "커밋 승인",
      body: "현재 변경사항을 커밋할까?",
      options: ["approve", "reject"],
    });

    expect(decision.decisionId).toBeTruthy();

    const snapshot = await getDashboardSnapshot();
    expect(snapshot.runs.find((item) => item.id === run?.id)?.status).toBe(
      "waiting_approval"
    );
    expect(
      snapshot.decisions.some((item) => item.id === decision.decisionId)
    ).toBe(true);
  });

  it("tracks card movement, heartbeat cadence, and shutdown flag", async () => {
    moveCard("card-sse", "doing");
    const activeHeartbeat = heartbeat({ sessionId: "test-session" });
    expect(activeHeartbeat.heartbeatIntervalSeconds).toBe(5);

    requestShutdown("test");
    const stoppedHeartbeat = heartbeat({ sessionId: "test-session" });

    expect(getSetting("shutdown_requested")).toBe("true");
    expect(stoppedHeartbeat.shutdownRequested).toBe(true);

    const snapshot = await getDashboardSnapshot();
    expect(snapshot.cards.find((card) => card.id === "card-sse")?.status).toBe(
      "doing"
    );
  });
});

