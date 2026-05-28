export type GoalStatus = "active" | "paused" | "complete";
export type MilestoneStatus = "planned" | "active" | "complete";
export type CardStatus = "backlog" | "ready" | "doing" | "review" | "done";
export type RunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";
export type RunMode = "standard" | "long" | "plan";
export type EventSeverity = "debug" | "info" | "success" | "warning" | "error";
export type DecisionStatus = "open" | "approved" | "rejected" | "resolved";

export type DashboardEventPayload = {
  kind:
    | "snapshot"
    | "run"
    | "event"
    | "decision"
    | "card"
    | "shutdown"
    | "heartbeat";
  id?: string;
  message?: string;
};

