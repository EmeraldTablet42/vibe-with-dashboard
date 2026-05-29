export type GoalStatus = "active" | "paused" | "complete";
export type MilestoneStatus = "planned" | "active" | "complete";
export type CardStatus = "backlog" | "ready" | "doing" | "review" | "done";
export type CardPriority = "high" | "medium" | "low";
export type ActivityPhase =
  | "start"
  | "plan"
  | "implement"
  | "verify"
  | "result"
  | "fail";
export type ActivityStatus = "active" | "done" | "failed";
export type DuckSuggestionPriority = "high" | "medium" | "low";

export type LocalizedText = {
  keyword?: string;
  title?: string;
  summary?: string;
  detail?: string;
  actionPrompt?: string;
  task?: string;
  message?: string;
  acceptanceCriteria?: string;
};
export type LocaleTranslations = Record<string, LocalizedText>;

export type DashboardEventPayload = {
  kind:
    | "snapshot"
    | "activity"
    | "board"
    | "checkpoint"
    | "card"
    | "goal"
    | "milestone"
    | "duck-suggestion";
  id?: string;
  message?: string;
};
