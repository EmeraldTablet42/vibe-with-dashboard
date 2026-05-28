import { EventEmitter } from "node:events";

import type { DashboardEventPayload } from "@/lib/types";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function publishDashboardEvent(payload: DashboardEventPayload) {
  emitter.emit("dashboard:event", {
    ...payload,
    emittedAt: new Date().toISOString(),
  });
}

export function subscribeDashboardEvents(
  listener: (payload: DashboardEventPayload & { emittedAt: string }) => void
) {
  emitter.on("dashboard:event", listener);

  return () => {
    emitter.off("dashboard:event", listener);
  };
}

