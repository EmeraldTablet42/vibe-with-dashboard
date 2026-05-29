import { randomUUID } from "node:crypto";

import { and, asc, desc, eq } from "drizzle-orm";

import { getDb, getSqlite, initializeDatabase } from "@/lib/db/client";
import { ensureSeedData } from "@/lib/db/seed";
import {
  activityEntries,
  agentCheckpoints,
  boardArchives,
  boards,
  cards,
  designTokens,
  duckSuggestions,
  goals,
  harnessProfiles,
  milestones,
  settings,
  subagents,
} from "@/lib/db/schema";
import {
  getProjectDesignSystemInventory,
  getProjectHarnessInventory,
} from "@/lib/harness/project";
import { getGithubStatus, getRepoStatus, getWorkspaceFiles } from "@/lib/repo/git";
import { publishDashboardEvent } from "@/lib/realtime/bus";
import type {
  ActivityPhase,
  ActivityStatus,
  CardPriority,
  CardStatus,
  DuckSuggestionPriority,
  GoalStatus,
  LocaleTranslations,
  MilestoneStatus,
} from "@/lib/types";

const now = () => new Date().toISOString();

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function stringifyTranslations(translations?: LocaleTranslations) {
  return JSON.stringify(translations ?? {});
}

const priorityRank: Record<DuckSuggestionPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const dashboardSeedTokenNames = new Set([
  "--radius",
  "--status-ready",
  "--status-done",
]);

function isDashboardSeedToken(row: { id: string; name: string }) {
  return row.id.startsWith("token-") && dashboardSeedTokenNames.has(row.name);
}

type PlanCardInput = {
  title: string;
  summary?: string;
  translations?: LocaleTranslations;
  priority?: CardPriority;
  status?: CardStatus;
  owner?: string;
  size?: string;
  acceptanceCriteria?: string;
  verificationCommand?: string;
  dependsOn?: string[];
  position?: number;
};

type PlanMilestoneInput = {
  title?: string;
  summary?: string;
  translations?: LocaleTranslations;
  status?: MilestoneStatus;
  priority?: CardPriority;
  position?: number;
  cards?: PlanCardInput[];
};

type PlanGoalInput = {
  title?: string;
  summary?: string;
  translations?: LocaleTranslations;
  status?: GoalStatus;
  priority?: CardPriority;
  position?: number;
  milestones?: PlanMilestoneInput[];
};

type PlanInput = {
  task: string;
  title?: string;
  summary?: string;
  source?: string;
  translations?: LocaleTranslations;
  replace?: boolean;
  milestone?: PlanMilestoneInput;
  milestones?: PlanMilestoneInput[];
  goals?: PlanGoalInput[];
  cards?: PlanCardInput[];
};

type CardProgressInput = {
  id?: string;
  title?: string;
  summary?: string;
  translations?: LocaleTranslations;
  status?: CardStatus;
  priority?: CardPriority;
  owner?: string;
  size?: string;
  acceptanceCriteria?: string;
  verificationCommand?: string;
  dependsOn?: string[];
  position?: number;
};

function compactPatch<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function normalized(value = "") {
  return value.trim().toLowerCase();
}

function rowMatchesTitle(
  row: { title: string; translationsJson?: string },
  requestedTitle = ""
) {
  const requested = normalized(requestedTitle);
  if (!requested) return false;
  if (normalized(row.title) === requested) return true;

  const translations = parseJson<LocaleTranslations>(row.translationsJson ?? "{}", {});
  return Object.values(translations).some(
    (translation) => normalized(translation.title) === requested
  );
}

function shouldReplacePlan(input: PlanInput) {
  if (input.replace !== undefined) return input.replace;
  return Boolean(input.goals?.length || input.milestones?.length);
}

function normalizePlan(input: PlanInput, fallbackSummary: string): PlanGoalInput[] {
  if (input.goals?.length) {
    return input.goals.map((goal, goalIndex) => ({
      ...goal,
      title: goal.title?.trim() || input.title?.trim() || input.task.trim(),
      summary: goal.summary?.trim() || input.summary?.trim() || fallbackSummary,
      translations: goal.translations ?? input.translations,
      position: goal.position ?? goalIndex + 1,
      milestones: goal.milestones?.length
        ? goal.milestones
        : [
            {
              ...(input.milestone ?? {}),
              cards: input.cards,
            },
          ],
    }));
  }

  const milestonesToUse =
    input.milestones?.length
      ? input.milestones
      : [
          {
            ...(input.milestone ?? {}),
            cards: input.cards,
          },
        ];

  return [
    {
      title: input.title?.trim() || input.task.trim(),
      summary: input.summary?.trim() || fallbackSummary,
      translations: input.translations,
      status: "active",
      priority: "high",
      position: 1,
      milestones: milestonesToUse,
    },
  ];
}

function deriveMilestoneStatus(cardRows: Array<{ status: string }>): MilestoneStatus {
  if (cardRows.length === 0) return "planned";
  if (cardRows.every((card) => card.status === "done")) return "complete";
  if (cardRows.some((card) => card.status === "doing" || card.status === "review")) {
    return "active";
  }
  if (cardRows.some((card) => card.status === "ready")) return "active";
  return "planned";
}

function deriveGoalStatus(milestoneRows: Array<{ status: string }>): GoalStatus {
  if (milestoneRows.length === 0) return "active";
  if (milestoneRows.every((milestone) => milestone.status === "complete")) {
    return "complete";
  }
  return "active";
}

function syncParentStatuses(boardId: string) {
  const db = getDb();
  const milestoneRows = db
    .select()
    .from(milestones)
    .where(eq(milestones.boardId, boardId))
    .all();
  const cardRows = db.select().from(cards).where(eq(cards.boardId, boardId)).all();

  for (const milestone of milestoneRows) {
    const nextStatus = deriveMilestoneStatus(
      cardRows.filter((card) => card.milestoneId === milestone.id)
    );
    if (nextStatus !== milestone.status) {
      db.update(milestones)
        .set({ status: nextStatus, updatedAt: now() })
        .where(eq(milestones.id, milestone.id))
        .run();
    }
  }

  const refreshedMilestones = db
    .select()
    .from(milestones)
    .where(eq(milestones.boardId, boardId))
    .all();
  for (const goal of db.select().from(goals).where(eq(goals.boardId, boardId)).all()) {
    const nextStatus = deriveGoalStatus(
      refreshedMilestones.filter((milestone) => milestone.goalId === goal.id)
    );
    if (nextStatus !== goal.status) {
      db.update(goals)
        .set({ status: nextStatus, updatedAt: now() })
        .where(eq(goals.id, goal.id))
        .run();
    }
  }
}

function getSettingsMap() {
  return Object.fromEntries(
    getDb()
      .select()
      .from(settings)
      .all()
      .map((setting) => [setting.key, setting.value])
  );
}

function getActiveBoardRow() {
  ensureSeedData();
  const settingsMap = getSettingsMap();
  const configured = settingsMap.active_board_id
    ? getDb()
        .select()
        .from(boards)
        .where(eq(boards.id, settingsMap.active_board_id))
        .get()
    : undefined;

  if (configured?.status === "active") return configured;

  const active = getDb()
    .select()
    .from(boards)
    .where(eq(boards.status, "active"))
    .orderBy(desc(boards.updatedAt))
    .get();

  if (!active) {
    initializeDatabase();
    const id = randomUUID();
    getDb()
      .insert(boards)
      .values({
        id,
        title: "No active plan",
        task: "",
        status: "active",
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
    upsertSetting("active_board_id", id);
    return getDb().select().from(boards).where(eq(boards.id, id)).get()!;
  }

  upsertSetting("active_board_id", active.id);
  return active;
}

function getBoardRows(boardId: string) {
  const db = getDb();
  const goalRows = db
    .select()
    .from(goals)
    .where(eq(goals.boardId, boardId))
    .orderBy(asc(goals.position))
    .all();
  const milestoneRows = db
    .select()
    .from(milestones)
    .where(eq(milestones.boardId, boardId))
    .orderBy(asc(milestones.position))
    .all();
  const cardRows = db
    .select()
    .from(cards)
    .where(eq(cards.boardId, boardId))
    .orderBy(asc(cards.position))
    .all();
  const activityRows = db
    .select()
    .from(activityEntries)
    .where(eq(activityEntries.boardId, boardId))
    .orderBy(desc(activityEntries.createdAt))
    .limit(80)
    .all();
  const checkpointRows = db
    .select()
    .from(agentCheckpoints)
    .where(eq(agentCheckpoints.boardId, boardId))
    .orderBy(desc(agentCheckpoints.createdAt))
    .limit(20)
    .all();
  const suggestionRows = db
    .select()
    .from(duckSuggestions)
    .where(eq(duckSuggestions.boardId, boardId))
    .orderBy(desc(duckSuggestions.createdAt))
    .all();

  const cardsWithDependencies = cardRows.map((card) => ({
    ...card,
    dependsOn: parseJson<string[]>(card.dependsOnJson, []),
    translations: parseJson<LocaleTranslations>(card.translationsJson, {}),
  }));

  return {
    goalRows,
    milestoneRows,
    cardRows,
    cardsWithDependencies,
    activityRows,
    checkpointRows,
    suggestionRows,
  };
}

export async function getDashboardSnapshot() {
  const activeBoard = getActiveBoardRow();
  const db = getDb();
  const {
    goalRows,
    milestoneRows,
    cardsWithDependencies,
    activityRows,
    checkpointRows,
    suggestionRows,
  } = getBoardRows(activeBoard.id);

  const [
    tokenRows,
    harnessRows,
    subagentRows,
    archiveRows,
    settingRows,
    repoStatus,
    githubStatus,
    workspaceFiles,
    harnessInventory,
    projectDesignSystem,
  ] = await Promise.all([
    Promise.resolve(db.select().from(designTokens).orderBy(asc(designTokens.name)).all()),
    Promise.resolve(db.select().from(harnessProfiles).orderBy(asc(harnessProfiles.name)).all()),
    Promise.resolve(db.select().from(subagents).orderBy(asc(subagents.name)).all()),
    Promise.resolve(
      db
        .select()
        .from(boardArchives)
        .orderBy(desc(boardArchives.createdAt))
        .limit(20)
        .all()
    ),
    Promise.resolve(db.select().from(settings).all()),
    getRepoStatus(),
    getGithubStatus(),
    getWorkspaceFiles(),
    getProjectHarnessInventory(),
    getProjectDesignSystemInventory(),
  ]);

  const settingsMap = Object.fromEntries(
    settingRows.map((setting) => [setting.key, setting.value])
  );
  const hasCards = cardsWithDependencies.length > 0;
  const archiveReady =
    hasCards &&
    cardsWithDependencies.every((card) => card.status === "done") &&
    activityRows.some((activity) => activity.phase === "result");

  return {
    generatedAt: now(),
    appId: "vibe-with-dashboard",
    board: {
      ...activeBoard,
      translations: parseJson<LocaleTranslations>(
        activeBoard.translationsJson,
        {}
      ),
      isEmpty: goalRows.length === 0 && cardsWithDependencies.length === 0,
      archiveReady,
    },
    archives: archiveRows.map((archive) => ({
      ...archive,
      snapshot: parseJson<Record<string, unknown>>(archive.snapshotJson, {}),
    })),
    goals: goalRows.map((goal) => ({
      ...goal,
      translations: parseJson<LocaleTranslations>(goal.translationsJson, {}),
      milestones: milestoneRows
        .filter((milestone) => milestone.goalId === goal.id)
        .map((milestone) => ({
          ...milestone,
          translations: parseJson<LocaleTranslations>(
            milestone.translationsJson,
            {}
          ),
          cards: cardsWithDependencies.filter(
            (card) => card.milestoneId === milestone.id
          ),
        })),
    })),
    cards: cardsWithDependencies,
    activityEntries: activityRows.map((activity) => ({
      ...activity,
      metadata: parseJson<Record<string, unknown>>(activity.metadataJson, {}),
      translations: parseJson<LocaleTranslations>(
        activity.translationsJson,
        {}
      ),
    })),
    duckSuggestions: suggestionRows
      .map((suggestion) => ({
        ...suggestion,
        translations: parseJson<LocaleTranslations>(
          suggestion.translationsJson,
          {}
        ),
      }))
      .sort((a, b) => {
        if (!a.readAt && b.readAt) return -1;
        if (a.readAt && !b.readAt) return 1;
        const priorityDiff =
          priorityRank[a.priority as DuckSuggestionPriority] -
          priorityRank[b.priority as DuckSuggestionPriority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.createdAt.localeCompare(a.createdAt);
      }),
    agentCheckpoints: checkpointRows.map((checkpoint) => ({
      ...checkpoint,
      payload: parseJson<Record<string, unknown>>(checkpoint.payloadJson, {}),
    })),
    designTokens: [
      ...projectDesignSystem.tokens,
      ...tokenRows
        .filter((token) => !isDashboardSeedToken(token))
        .map((token) => ({
          ...token,
          sourcePath: "agent-recorded",
          sourceKind: "agent-note" as const,
        })),
    ],
    designSystem: projectDesignSystem,
    harnessProfiles: harnessRows.map((profile) => ({
      ...profile,
      skills: parseJson<string[]>(profile.skillsJson, []),
      mcp: parseJson<Record<string, string>>(profile.mcpJson, {}),
    })),
    subagents: subagentRows.map((agent) => ({
      ...agent,
      tools: parseJson<string[]>(agent.toolsJson, []),
    })),
    settings: settingsMap,
    repoStatus,
    githubStatus,
    workspaceFiles,
    harnessInventory,
    launch: {
      dashboardUrl: settingsMap.dashboard_url ?? "http://127.0.0.1:3000",
      command: "$vibe-with-dashboard <user task>",
    },
  };
}

export function upsertPlan(input: PlanInput) {
  const board = getActiveBoardRow();
  const title = input.title?.trim() || input.task.trim() || "Untitled task";
  const summary =
    input.summary?.trim() ||
    "The active board tracks LLM agent progress across Plan and Kanban.";
  const db = getDb();
  const replacePlan = shouldReplacePlan(input);
  const normalizedGoals = normalizePlan(input, summary);

  db.update(boards)
    .set(compactPatch({
      title,
      task: input.task,
      translationsJson: input.translations
        ? stringifyTranslations(input.translations)
        : undefined,
      status: "active",
      updatedAt: now(),
    }))
    .where(eq(boards.id, board.id))
    .run();

  if (replacePlan) {
    db.delete(activityEntries).where(eq(activityEntries.boardId, board.id)).run();
    db.delete(agentCheckpoints).where(eq(agentCheckpoints.boardId, board.id)).run();
    db.delete(duckSuggestions).where(eq(duckSuggestions.boardId, board.id)).run();
    db.delete(cards).where(eq(cards.boardId, board.id)).run();
    db.delete(milestones).where(eq(milestones.boardId, board.id)).run();
    db.delete(goals).where(eq(goals.boardId, board.id)).run();

    for (const [goalIndex, requestedGoal] of normalizedGoals.entries()) {
      const goalId = randomUUID();
      const goalTitle = requestedGoal.title?.trim() || title;
      const goalSummary = requestedGoal.summary?.trim() || summary;
      db.insert(goals)
        .values({
          id: goalId,
          boardId: board.id,
          title: goalTitle,
          summary: goalSummary,
          translationsJson: stringifyTranslations(
            requestedGoal.translations ?? input.translations
          ),
          status: requestedGoal.status ?? "active",
          priority: requestedGoal.priority ?? "high",
          position: requestedGoal.position ?? goalIndex + 1,
          createdAt: now(),
          updatedAt: now(),
        })
        .run();

      const requestedMilestones = requestedGoal.milestones?.length
        ? requestedGoal.milestones
        : [
            {
              title: input.milestone?.title,
              summary: input.milestone?.summary,
              translations: input.milestone?.translations,
              cards: input.cards,
            },
          ];

      for (const [milestoneIndex, requestedMilestone] of requestedMilestones.entries()) {
        const milestoneId = randomUUID();
        const milestoneTitle =
          requestedMilestone.title?.trim() ||
          (requestedMilestones.length === 1 ? "Current work" : `Milestone ${milestoneIndex + 1}`);
        const milestoneSummary = requestedMilestone.summary?.trim() || goalSummary;
        db.insert(milestones)
          .values({
            id: milestoneId,
            boardId: board.id,
            goalId,
            title: milestoneTitle,
            summary: milestoneSummary,
            translationsJson: stringifyTranslations(requestedMilestone.translations),
            status: requestedMilestone.status ?? "active",
            priority: requestedMilestone.priority ?? "high",
            position: requestedMilestone.position ?? milestoneIndex + 1,
            createdAt: now(),
            updatedAt: now(),
          })
          .run();

        const requestedCards = requestedMilestone.cards ?? [];
        for (const [cardIndex, card] of requestedCards.entries()) {
          db.insert(cards)
            .values({
              id: randomUUID(),
              boardId: board.id,
              milestoneId,
              title: card.title,
              summary: card.summary || milestoneSummary,
              translationsJson: stringifyTranslations(card.translations),
              status: card.status ?? "ready",
              priority: card.priority ?? "medium",
              owner: card.owner ?? "agent",
              size: card.size ?? "M",
              acceptanceCriteria: card.acceptanceCriteria ?? "",
              verificationCommand: card.verificationCommand ?? "",
              dependsOnJson: JSON.stringify(card.dependsOn ?? []),
              position: card.position ?? cardIndex + 1,
              createdAt: now(),
              updatedAt: now(),
            })
            .run();
        }
      }
    }

    syncParentStatuses(board.id);
    addActivity({
      phase: "plan",
      source: input.source ?? "agent",
      status: "done",
      task: input.task,
      title: "Plan updated",
      message: title,
      metadata: {
        goals: normalizedGoals.length,
        milestones: normalizedGoals.reduce(
          (count, goal) => count + (goal.milestones?.length ?? 0),
          0
        ),
        cards: normalizedGoals.reduce(
          (count, goal) =>
            count +
            (goal.milestones ?? []).reduce(
              (cardCount, milestone) => cardCount + (milestone.cards?.length ?? 0),
              0
            ),
          0
        ),
        replace: true,
      },
      translations: input.translations,
    });

    publishDashboardEvent({ kind: "snapshot", id: board.id, message: "plan" });
    return { boardId: board.id };
  }

  let goal = db
    .select()
    .from(goals)
    .where(eq(goals.boardId, board.id))
    .orderBy(asc(goals.position))
    .get();

  if (!goal) {
    const goalId = randomUUID();
    db.insert(goals)
      .values({
        id: goalId,
        boardId: board.id,
        title,
        summary,
        translationsJson: stringifyTranslations(input.translations),
        status: "active",
        priority: "high",
        position: 1,
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
    goal = db.select().from(goals).where(eq(goals.id, goalId)).get();
  } else {
    db.update(goals)
      .set(
        compactPatch({
          title,
          summary,
          translationsJson: input.translations
            ? stringifyTranslations(input.translations)
            : undefined,
          status: "active",
          updatedAt: now(),
        })
      )
      .where(eq(goals.id, goal.id))
      .run();
  }

  if (!goal) throw new Error("failed to create goal");

  let milestone = db
    .select()
    .from(milestones)
    .where(eq(milestones.boardId, board.id))
    .orderBy(asc(milestones.position))
    .get();

  if (!milestone) {
    const milestoneId = randomUUID();
    const milestoneTitle = input.milestone?.title?.trim() || "Current work";
    const milestoneSummary = input.milestone?.summary?.trim() || summary;
    db.insert(milestones)
      .values({
        id: milestoneId,
        boardId: board.id,
        goalId: goal.id,
        title: milestoneTitle,
        summary: milestoneSummary,
        translationsJson: stringifyTranslations(input.milestone?.translations),
        status: "active",
        priority: "high",
        position: 1,
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
    milestone = db.select().from(milestones).where(eq(milestones.id, milestoneId)).get();
  } else if (input.milestone) {
    db.update(milestones)
      .set(
        compactPatch({
          title: input.milestone.title?.trim(),
          summary: input.milestone.summary?.trim(),
          translationsJson: input.milestone.translations
            ? stringifyTranslations(input.milestone.translations)
            : undefined,
          updatedAt: now(),
        })
      )
      .where(eq(milestones.id, milestone.id))
      .run();
  }

  if (!milestone) throw new Error("failed to create milestone");

  const existingCards = db
    .select()
    .from(cards)
    .where(eq(cards.boardId, board.id))
    .all();
  const requestedCards =
    input.cards && input.cards.length > 0
      ? input.cards
      : [
          {
            title,
            summary,
            priority: "high" as const,
            status: "ready" as const,
            size: "M",
          },
        ];

  for (const [index, card] of requestedCards.entries()) {
    const existingCard = existingCards.find(
      (item) => rowMatchesTitle(item, card.title)
    );

    if (existingCard) {
      db.update(cards)
        .set(
          compactPatch({
            summary: card.summary,
            translationsJson: card.translations
              ? stringifyTranslations(card.translations)
              : undefined,
            status: card.status,
            priority: card.priority,
            owner: card.owner,
            size: card.size,
            acceptanceCriteria: card.acceptanceCriteria,
            verificationCommand: card.verificationCommand,
            dependsOnJson: card.dependsOn
              ? JSON.stringify(card.dependsOn)
              : undefined,
            position: card.position,
            updatedAt: now(),
          })
        )
        .where(eq(cards.id, existingCard.id))
        .run();
      continue;
    }

    db.insert(cards)
      .values({
        id: randomUUID(),
        boardId: board.id,
        milestoneId: milestone.id,
        title: card.title,
        summary: card.summary || summary,
        translationsJson: stringifyTranslations(card.translations),
        status: card.status ?? "ready",
        priority: card.priority ?? "medium",
        owner: card.owner ?? "agent",
        size: card.size ?? "M",
        acceptanceCriteria: card.acceptanceCriteria ?? "",
        verificationCommand: card.verificationCommand ?? "",
        dependsOnJson: JSON.stringify(card.dependsOn ?? []),
        position: card.position ?? existingCards.length + index + 1,
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
  }

  addActivity({
    phase: "plan",
    source: input.source ?? "agent",
    status: "done",
    task: input.task,
    title: "Plan updated",
    message: title,
    metadata: { cards: requestedCards.length },
    translations: input.translations,
  });

  syncParentStatuses(board.id);
  publishDashboardEvent({ kind: "snapshot", id: board.id, message: "plan" });
  return { boardId: board.id };
}

export function replaceDuckSuggestions(input: {
  suggestions: Array<{
    keyword: string;
    title: string;
    summary?: string;
    detail?: string;
    actionPrompt?: string;
    priority?: DuckSuggestionPriority;
    source?: string;
    translations?: LocaleTranslations;
  }>;
  source?: string;
}) {
  const board = getActiveBoardRow();
  const db = getDb();
  const createdAt = now();

  db.delete(duckSuggestions).where(eq(duckSuggestions.boardId, board.id)).run();

  if (input.suggestions.length === 0) {
    publishDashboardEvent({
      kind: "duck-suggestion",
      id: board.id,
      message: "cleared",
    });
    return { boardId: board.id, count: 0 };
  }

  db.insert(duckSuggestions)
    .values(
      input.suggestions.slice(0, 5).map((suggestion) => ({
        id: randomUUID(),
        boardId: board.id,
        keyword: suggestion.keyword.trim(),
        title: suggestion.title.trim(),
        summary: suggestion.summary?.trim() ?? "",
        detail: suggestion.detail?.trim() ?? "",
        actionPrompt: suggestion.actionPrompt?.trim() ?? "",
        priority: suggestion.priority ?? "medium",
        source: suggestion.source ?? input.source ?? "agent",
        translationsJson: stringifyTranslations(suggestion.translations),
        createdAt,
        updatedAt: createdAt,
      }))
    )
    .run();

  publishDashboardEvent({
    kind: "duck-suggestion",
    id: board.id,
    message: "updated",
  });
  return { boardId: board.id, count: Math.min(5, input.suggestions.length) };
}

export function markDuckSuggestionRead(id: string) {
  const board = getActiveBoardRow();
  const readAt = now();
  const result = getDb()
    .update(duckSuggestions)
    .set({ readAt, updatedAt: readAt })
    .where(and(eq(duckSuggestions.boardId, board.id), eq(duckSuggestions.id, id)))
    .run();
  if (result.changes === 0) {
    return { updated: false, reason: "suggestion-not-found", id };
  }
  publishDashboardEvent({ kind: "duck-suggestion", id, message: "read" });
  return { updated: true, id, readAt };
}

export function updateCardProgress(input: CardProgressInput) {
  const board = getActiveBoardRow();
  const db = getDb();
  const lookupById = Boolean(input.id);
  const card = input.id
    ? db
        .select()
        .from(cards)
        .where(and(eq(cards.boardId, board.id), eq(cards.id, input.id)))
        .get()
    : input.title
      ? db
          .select()
          .from(cards)
          .where(eq(cards.boardId, board.id))
          .orderBy(asc(cards.position))
          .all()
          .find((item) => rowMatchesTitle(item, input.title))
      : undefined;

  if (!card) {
    return {
      updated: false,
      reason: "card-not-found",
      title: input.title,
      id: input.id,
    };
  }

  const patch = compactPatch({
    title: lookupById ? input.title?.trim() : undefined,
    summary: input.summary?.trim(),
    translationsJson: input.translations
      ? stringifyTranslations(input.translations)
      : undefined,
    status: input.status,
    priority: input.priority,
    owner: input.owner,
    size: input.size,
    acceptanceCriteria: input.acceptanceCriteria,
    verificationCommand: input.verificationCommand,
    dependsOnJson: input.dependsOn ? JSON.stringify(input.dependsOn) : undefined,
    position: input.position,
    updatedAt: now(),
  });

  db.update(cards).set(patch).where(eq(cards.id, card.id)).run();
  syncParentStatuses(board.id);
  publishDashboardEvent({ kind: "card", id: card.id, message: "progress" });
  const archive = archiveActiveBoard();

  return {
    updated: true,
    cardId: card.id,
    title: input.title ?? card.title,
    archive,
  };
}

export function updateCardsProgress(updates: CardProgressInput[]) {
  return updates.map((update) => updateCardProgress(update));
}

export function archiveActiveBoard() {
  const board = getActiveBoardRow();
  const {
    goalRows,
    milestoneRows,
    cardsWithDependencies,
    activityRows,
    checkpointRows,
    suggestionRows,
  } = getBoardRows(board.id);
  const hasCards = cardsWithDependencies.length > 0;
  const hasResult = activityRows.some((activity) => activity.phase === "result");
  const allDone = hasCards && cardsWithDependencies.every((card) => card.status === "done");

  if (!hasCards || !allDone || !hasResult) {
    return {
      archived: false,
      reason: !hasCards
        ? "no-cards"
        : !allDone
          ? "cards-not-done"
          : "missing-result",
    };
  }

  const archiveId = randomUUID();
  const archivedAt = now();
  const archivedCards = cardsWithDependencies;
  const archivedGoals = goalRows.map((goal) => ({
    ...goal,
    translations: parseJson<LocaleTranslations>(goal.translationsJson, {}),
    milestones: milestoneRows
      .filter((milestone) => milestone.goalId === goal.id)
      .map((milestone) => ({
        ...milestone,
        translations: parseJson<LocaleTranslations>(
          milestone.translationsJson,
          {}
        ),
        cards: archivedCards.filter((card) => card.milestoneId === milestone.id),
      })),
  }));
  const archivedActivities = activityRows.map((activity) => ({
    ...activity,
    metadata: parseJson<Record<string, unknown>>(activity.metadataJson, {}),
    translations: parseJson<LocaleTranslations>(
      activity.translationsJson,
      {}
    ),
  }));
  const archivedDuckSuggestions = suggestionRows.map((suggestion) => ({
    ...suggestion,
    translations: parseJson<LocaleTranslations>(
      suggestion.translationsJson,
      {}
    ),
  }));

  getDb()
    .insert(boardArchives)
    .values({
      id: archiveId,
      boardId: board.id,
      title: board.title,
      task: board.task,
      snapshotJson: JSON.stringify({
        board: {
          ...board,
          translations: parseJson<LocaleTranslations>(board.translationsJson, {}),
        },
        goals: archivedGoals,
        milestones: milestoneRows,
        cards: archivedCards,
        activityEntries: archivedActivities,
        duckSuggestions: archivedDuckSuggestions,
        agentCheckpoints: checkpointRows,
        archivedAt,
      }),
      createdAt: archivedAt,
    })
    .run();

  getDb()
    .update(boards)
    .set({ status: "archived", archivedAt, updatedAt: archivedAt })
    .where(eq(boards.id, board.id))
    .run();

  const nextBoardId = randomUUID();
  getDb()
    .insert(boards)
    .values({
      id: nextBoardId,
      title: "No active plan",
      task: "",
      status: "active",
      createdAt: archivedAt,
      updatedAt: archivedAt,
    })
    .run();
  upsertSetting("active_board_id", nextBoardId);

  publishDashboardEvent({ kind: "snapshot", id: nextBoardId, message: "archive" });
  return { archived: true, archiveId, boardId: nextBoardId };
}

export function deleteArchive(id: string) {
  ensureSeedData();
  const db = getDb();
  const archive = db
    .select()
    .from(boardArchives)
    .where(eq(boardArchives.id, id))
    .get();

  if (!archive) {
    return { deleted: false, reason: "not-found" as const, id };
  }

  db.delete(boardArchives).where(eq(boardArchives.id, id)).run();
  publishDashboardEvent({ kind: "snapshot", id, message: "archive-deleted" });
  return { deleted: true, id };
}

export function clearArchives() {
  ensureSeedData();
  const db = getDb();
  const count = db.select().from(boardArchives).all().length;
  db.delete(boardArchives).run();
  publishDashboardEvent({ kind: "snapshot", message: "archives-cleared" });
  return { deleted: count };
}

export function addActivity(input: {
  phase: ActivityPhase;
  source?: string;
  status?: ActivityStatus;
  task?: string;
  title: string;
  message: string;
  translations?: LocaleTranslations;
  metadata?: unknown;
}) {
  const board = getActiveBoardRow();
  const id = randomUUID();
  getDb()
    .insert(activityEntries)
    .values({
      id,
      boardId: board.id,
      phase: input.phase,
      source: input.source ?? "agent",
      status: input.status ?? "done",
      task: input.task ?? "",
      title: input.title,
      message: input.message,
      translationsJson: stringifyTranslations(input.translations),
      metadataJson: JSON.stringify(input.metadata ?? {}),
      createdAt: now(),
    })
    .run();

  publishDashboardEvent({ kind: "activity", id, message: input.title });
  const activity = getActivityById(id);
  if (input.phase === "result") {
    archiveActiveBoard();
  }
  return activity;
}

export function getActivityById(id: string) {
  ensureSeedData();
  const row = getDb()
    .select()
    .from(activityEntries)
    .where(eq(activityEntries.id, id))
    .get();

  if (!row) return undefined;
  return {
    ...row,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    translations: parseJson<LocaleTranslations>(row.translationsJson, {}),
  };
}

export function addAgentCheckpoint(input: {
  agent?: string;
  task?: string;
  status?: "active" | "idle" | "done" | "failed";
  summary: string;
  payload?: unknown;
}) {
  const board = getActiveBoardRow();
  const id = randomUUID();
  getDb()
    .insert(agentCheckpoints)
    .values({
      id,
      boardId: board.id,
      agent: input.agent ?? "agent",
      task: input.task ?? "",
      status: input.status ?? "active",
      summary: input.summary,
      payloadJson: JSON.stringify(input.payload ?? {}),
      createdAt: now(),
    })
    .run();

  publishDashboardEvent({ kind: "checkpoint", id, message: input.summary });
  return id;
}

export function updateCard(
  cardId: string,
  input: {
    title?: string;
    summary?: string;
    translations?: LocaleTranslations;
    status?: CardStatus;
    priority?: CardPriority;
    position?: number;
  }
) {
  const board = getActiveBoardRow();
  const card = getDb()
    .select()
    .from(cards)
    .where(and(eq(cards.boardId, board.id), eq(cards.id, cardId)))
    .get();
  if (!card) {
    return { updated: false, reason: "card-not-found", id: cardId };
  }
  const { translations, ...fields } = input;
  const patch = compactPatch({
    ...fields,
    translationsJson: translations ? stringifyTranslations(translations) : undefined,
    updatedAt: now(),
  });
  getDb()
    .update(cards)
    .set(patch)
    .where(and(eq(cards.boardId, board.id), eq(cards.id, cardId)))
    .run();

  addActivity({
    phase: "implement",
    source: "dashboard",
    status: "done",
    task: cardId,
    title: "Card updated",
    message: `${card.title} status changed.`,
    metadata: input,
  });
  syncParentStatuses(card.boardId);
  publishDashboardEvent({ kind: "card", id: cardId, message: "updated" });
  archiveActiveBoard();
  return { updated: true, id: cardId };
}

export function updateGoal(
  goalId: string,
  input: {
    title?: string;
    summary?: string;
    translations?: LocaleTranslations;
    status?: GoalStatus;
    priority?: CardPriority;
    position?: number;
  }
) {
  const board = getActiveBoardRow();
  const { translations, ...fields } = input;
  const patch = compactPatch({
    ...fields,
    translationsJson: translations ? stringifyTranslations(translations) : undefined,
    updatedAt: now(),
  });
  const result = getDb()
    .update(goals)
    .set(patch)
    .where(and(eq(goals.boardId, board.id), eq(goals.id, goalId)))
    .run();
  if (result.changes === 0) {
    return { updated: false, reason: "goal-not-found", id: goalId };
  }
  publishDashboardEvent({ kind: "goal", id: goalId, message: "updated" });
  return { updated: true, id: goalId };
}

export function updateMilestone(
  milestoneId: string,
  input: {
    title?: string;
    summary?: string;
    translations?: LocaleTranslations;
    status?: MilestoneStatus;
    priority?: CardPriority;
    position?: number;
  }
) {
  const board = getActiveBoardRow();
  const { translations, ...fields } = input;
  const patch = compactPatch({
    ...fields,
    translationsJson: translations ? stringifyTranslations(translations) : undefined,
    updatedAt: now(),
  });
  getDb()
    .update(milestones)
    .set(patch)
    .where(and(eq(milestones.boardId, board.id), eq(milestones.id, milestoneId)))
    .run();
  const result = getDb()
    .select()
    .from(milestones)
    .where(and(eq(milestones.boardId, board.id), eq(milestones.id, milestoneId)))
    .get();
  if (!result) {
    return { updated: false, reason: "milestone-not-found", id: milestoneId };
  }
  publishDashboardEvent({
    kind: "milestone",
    id: milestoneId,
    message: "updated",
  });
  return { updated: true, id: milestoneId };
}

export function upsertSetting(key: string, value: string) {
  initializeDatabase();
  getSqlite()
    .prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (@key, @value, @updatedAt)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run({ key, value, updatedAt: now() });
}

export function getSetting(key: string, fallback = "") {
  initializeDatabase();
  const row = getDb().select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? fallback;
}
