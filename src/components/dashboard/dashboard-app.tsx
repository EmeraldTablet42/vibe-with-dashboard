"use client";

import * as React from "react";
import {
  Activity,
  Archive,
  Bot,
  Boxes,
  CheckCircle2,
  CircleDot,
  Clock3,
  Copy,
  GitBranch,
  GitPullRequest,
  GripVertical,
  LayoutDashboard,
  ListChecks,
  Minimize2,
  MoonStar,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings2,
  Sparkles,
  SquareKanban,
  Workflow,
} from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  DashboardActivity,
  DashboardCard,
  DashboardSnapshot,
} from "@/lib/dashboard-types";
import {
  dashboardMessages,
  resolveLocale,
  type DashboardMessages,
  type SupportedLocale,
} from "@/lib/i18n";
import type { CardPriority, CardStatus, LocaleTranslations } from "@/lib/types";

const DEFAULT_PLAN_WIDTH = 360;
const MIN_PLAN_WIDTH = 280;
const MAX_PLAN_WIDTH = 560;

const statuses: CardStatus[] = ["backlog", "ready", "doing", "review", "done"];
const priorities: CardPriority[] = ["high", "medium", "low"];
const phases = ["start", "plan", "implement", "verify", "result"] as const;

const statusTone: Record<CardStatus, string> = {
  backlog: "bg-muted/20",
  ready: "bg-status-ready/15",
  doing: "bg-status-running/15",
  review: "bg-status-review/15",
  done: "bg-status-done/15",
};

const statusBadgeClass: Record<CardStatus, string> = {
  backlog:
    "border-zinc-500/70 bg-zinc-100 text-zinc-900 dark:border-zinc-400/60 dark:bg-zinc-700 dark:text-zinc-50",
  ready:
    "border-sky-600/70 bg-sky-100 text-sky-950 dark:border-sky-300/70 dark:bg-sky-500 dark:text-sky-950",
  doing:
    "border-amber-600/70 bg-amber-100 text-amber-950 dark:border-amber-300/70 dark:bg-amber-400 dark:text-amber-950",
  review:
    "border-violet-600/70 bg-violet-100 text-violet-950 dark:border-violet-300/70 dark:bg-violet-400 dark:text-violet-950",
  done:
    "border-emerald-700/70 bg-emerald-100 text-emerald-950 dark:border-emerald-300/70 dark:bg-emerald-400 dark:text-emerald-950",
};

const priorityBadgeClass: Record<CardPriority, string> = {
  high:
    "border-rose-600/70 bg-rose-100 text-rose-950 dark:border-rose-300/70 dark:bg-rose-400 dark:text-rose-950",
  medium:
    "border-orange-600/70 bg-orange-100 text-orange-950 dark:border-orange-300/70 dark:bg-orange-300 dark:text-orange-950",
  low:
    "border-teal-700/70 bg-teal-100 text-teal-950 dark:border-teal-300/70 dark:bg-teal-300 dark:text-teal-950",
};

type ArchiveRecord = DashboardSnapshot["archives"][number];
type DuckSuggestion = DashboardSnapshot["duckSuggestions"][number];
type ArchiveGoal = Omit<DashboardSnapshot["goals"][number], "milestones"> & {
  milestones?: DashboardSnapshot["goals"][number]["milestones"];
};
type ArchiveMilestone = Omit<
  DashboardSnapshot["goals"][number]["milestones"][number],
  "cards"
> & {
  cards?: DashboardCard[];
};

type ArchivedSnapshot = {
  board?: DashboardSnapshot["board"];
  goals?: ArchiveGoal[];
  milestones?: ArchiveMilestone[];
  cards?: DashboardCard[];
  activityEntries?: DashboardActivity[];
  duckSuggestions?: DuckSuggestion[];
  archivedAt?: string;
};

function useLocale() {
  const [locale] = React.useState<SupportedLocale>(() =>
    typeof navigator === "undefined" ? "en" : resolveLocale(navigator.languages)
  );

  return {
    locale,
    messages: dashboardMessages[locale],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function formatTime(value: string, locale: SupportedLocale, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function readArchiveSnapshot(archive?: ArchiveRecord): ArchivedSnapshot {
  return (archive?.snapshot ?? {}) as ArchivedSnapshot;
}

function localizedText(
  entity: {
    translations?: LocaleTranslations;
  },
  locale: SupportedLocale,
  field: keyof LocaleTranslations[string],
  fallback = ""
) {
  const translated = entity.translations?.[locale]?.[field];
  return translated?.trim() || fallback;
}

function StatusBadge({
  messages,
  status,
}: {
  messages: DashboardMessages;
  status: CardStatus;
}) {
  return (
    <Badge variant="outline" className={`font-semibold ${statusBadgeClass[status]}`}>
      {messages.status[status]}
    </Badge>
  );
}

function PriorityBadge({
  messages,
  priority,
}: {
  messages: DashboardMessages;
  priority: CardPriority;
}) {
  const label =
    priority === "high"
      ? messages.high
      : priority === "medium"
        ? messages.medium
        : messages.low;
  return (
    <Badge
      variant="outline"
      className={`font-semibold ${priorityBadgeClass[priority]}`}
    >
      {label}
    </Badge>
  );
}

function normalizeArchiveGoals(snapshot: ArchivedSnapshot): DashboardSnapshot["goals"] {
  const goals = snapshot.goals ?? [];
  if (goals.every((goal) => Array.isArray(goal.milestones))) {
    return goals as DashboardSnapshot["goals"];
  }

  const milestones = snapshot.milestones ?? [];
  const cards = snapshot.cards ?? [];

  return goals.map((goal) => ({
    ...goal,
    milestones: milestones
      .filter((milestone) => milestone.goalId === goal.id)
      .map((milestone) => ({
        ...milestone,
        cards: milestone.cards ?? cards.filter((card) => card.milestoneId === milestone.id),
      })),
  })) as DashboardSnapshot["goals"];
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export function DashboardApp({
  initialSnapshot,
}: {
  initialSnapshot: DashboardSnapshot;
}) {
  const { locale, messages: m, timeZone } = useLocale();
  const [snapshot, setSnapshot] = React.useState(initialSnapshot);
  const [mainTab, setMainTab] = React.useState("active");
  const [planOpen, setPlanOpen] = React.useState(true);
  const [planWidth, setPlanWidth] = React.useState(DEFAULT_PLAN_WIDTH);
  const [selectedArchiveId, setSelectedArchiveId] = React.useState(
    initialSnapshot.archives[0]?.id ?? ""
  );

  const refresh = React.useCallback(async () => {
    const response = await fetch("/api/dashboard/snapshot", {
      cache: "no-store",
    });
    setSnapshot(await response.json());
  }, []);

  React.useEffect(() => {
    const source = new EventSource("/api/events/stream");
    source.onmessage = async () => {
      await refresh();
    };
    return () => source.close();
  }, [refresh]);

  async function handleDragEnd(event: DragEndEvent) {
    const cardId = String(event.active.id);
    const target = event.over?.id ? String(event.over.id) : "";
    const [status, priority] = target.split(":") as [
      CardStatus | undefined,
      CardPriority | undefined,
    ];

    if (!status || !priority) return;
    if (!statuses.includes(status) || !priorities.includes(priority)) return;

    await patchJson(`/api/cards/${cardId}`, { status, priority });
    await refresh();
  }

  function openPlanSidebar() {
    setPlanWidth(DEFAULT_PLAN_WIDTH);
    setPlanOpen(true);
  }

  function startPlanResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = planWidth;

    const move = (moveEvent: PointerEvent) => {
      setPlanWidth(
        Math.min(
          MAX_PLAN_WIDTH,
          Math.max(MIN_PLAN_WIDTH, startWidth + moveEvent.clientX - startX)
        )
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  const doingCards = snapshot.cards.filter((card) => card.status === "doing");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Tabs
        value={mainTab}
        onValueChange={setMainTab}
        className="flex min-h-screen flex-col"
      >
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            <LayoutDashboard className="size-5 text-accent-cyan" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">
                Vibe with Dashboard
              </h1>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {snapshot.launch.dashboardUrl}
              </p>
            </div>
          </div>

          <TabsList className="ml-2">
            <TabsTrigger value="active">
              <SquareKanban className="size-4" />
              {m.active}
            </TabsTrigger>
            <TabsTrigger value="archive">
              <Archive className="size-4" />
              {m.archive}
            </TabsTrigger>
          </TabsList>

          <div className="ml-auto flex items-center gap-2">
            {!planOpen && mainTab === "active" && (
              <IconTip label={m.openPlan}>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={openPlanSidebar}
                  aria-label={m.openPlan}
                >
                  <PanelLeftOpen className="size-4" />
                </Button>
              </IconTip>
            )}
            <IconTip label={m.refresh}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={refresh}
                aria-label={m.refresh}
              >
                <RefreshCw className="size-4" />
              </Button>
            </IconTip>
            <ThemeToggle label={m.theme} />
            <ActivitySheet
              activities={snapshot.activityEntries}
              cards={snapshot.cards}
              doingCount={doingCards.length}
              locale={locale}
              messages={m}
              timeZone={timeZone}
            />
            <InspectorSheet snapshot={snapshot} messages={m} />
          </div>
        </header>

        <TabsContent value="active" className="m-0 min-h-0 flex-1">
          <ActiveBoard
            handleDragEnd={handleDragEnd}
            locale={locale}
            messages={m}
            planOpen={planOpen}
            planWidth={planWidth}
            setPlanOpen={setPlanOpen}
            snapshot={snapshot}
            startPlanResize={startPlanResize}
          />
        </TabsContent>

        <TabsContent value="archive" className="m-0 min-h-0 flex-1">
          <ArchiveBoard
            archives={snapshot.archives}
            locale={locale}
            messages={m}
            selectedArchiveId={selectedArchiveId}
            setSelectedArchiveId={setSelectedArchiveId}
            timeZone={timeZone}
          />
        </TabsContent>
      </Tabs>
      <RubberDuck
        locale={locale}
        messages={m}
        onRefresh={refresh}
        suggestions={snapshot.duckSuggestions}
      />
    </main>
  );
}

function ActiveBoard({
  handleDragEnd,
  locale,
  messages,
  planOpen,
  planWidth,
  setPlanOpen,
  snapshot,
  startPlanResize,
}: {
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
  locale: SupportedLocale;
  messages: DashboardMessages;
  planOpen: boolean;
  planWidth: number;
  setPlanOpen: (open: boolean) => void;
  snapshot: DashboardSnapshot;
  startPlanResize: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1">
      {planOpen ? (
        <section
          data-testid="plan-sidebar"
          className="relative min-h-0 shrink-0 border-r border-border bg-background"
          style={{ width: planWidth }}
        >
          <PanelHeader
            action={
              <IconTip label={messages.closePlan}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPlanOpen(false)}
                  aria-label={messages.closePlan}
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </IconTip>
            }
            icon={<Workflow className="size-4" />}
            meta={snapshot.board.isEmpty ? messages.empty : snapshot.board.status}
            title={messages.plan}
          />
          <ScrollArea className="h-[calc(100vh-7.5rem)]">
            <PlanPanel locale={locale} messages={messages} snapshot={snapshot} />
          </ScrollArea>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => {
            setPlanOpen(true);
          }}
          className="flex w-11 shrink-0 items-center justify-center border-r border-border bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground"
          aria-label={messages.openPlan}
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}

      {planOpen && (
        <button
          type="button"
          aria-label={messages.resizePlan}
          onPointerDown={startPlanResize}
          className="z-10 w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-accent-cyan/40 focus-visible:bg-accent-cyan/50 focus-visible:outline-none"
        />
      )}

      <section className="min-w-0 flex-1">
        <PanelHeader
          icon={<SquareKanban className="size-4" />}
          meta={snapshot.board.archiveReady ? messages.archiveReady : messages.current}
          title={messages.kanban}
        />
        <ScrollArea className="h-[calc(100vh-7.5rem)]">
          <div className="space-y-4 p-4">
            <CurrentWorkVisual
              locale={locale}
              messages={messages}
              snapshot={snapshot}
            />
            <DndContext id="dashboard-kanban" onDragEnd={handleDragEnd}>
              <KanbanMatrix
                cards={snapshot.cards}
                locale={locale}
                messages={messages}
              />
            </DndContext>
          </div>
        </ScrollArea>
      </section>
    </div>
  );
}

function ArchiveBoard({
  archives,
  locale,
  messages,
  selectedArchiveId,
  setSelectedArchiveId,
  timeZone,
}: {
  archives: ArchiveRecord[];
  locale: SupportedLocale;
  messages: DashboardMessages;
  selectedArchiveId: string;
  setSelectedArchiveId: (id: string) => void;
  timeZone: string;
}) {
  if (archives.length === 0) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-muted-foreground">
        {messages.noArchivedBoards}
      </div>
    );
  }

  const selected = archives.find((archive) => archive.id === selectedArchiveId) ?? archives[0];
  const snapshot = readArchiveSnapshot(selected);
  const cards = snapshot.cards ?? [];
  const activities = snapshot.activityEntries ?? [];
  const archiveGoals = normalizeArchiveGoals(snapshot);

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-[20rem_1fr]">
      <aside className="border-r border-border">
        <PanelHeader
          icon={<Archive className="size-4" />}
          meta={String(archives.length)}
          title={messages.archive}
        />
        <ScrollArea className="h-[calc(100vh-6.5rem)]">
          <div className="space-y-2 p-3">
            {archives.map((archive) => (
              <ArchiveListItem
                archive={archive}
                isSelected={archive.id === selected.id}
                key={archive.id}
                locale={locale}
                messages={messages}
                onSelect={() => setSelectedArchiveId(archive.id)}
                timeZone={timeZone}
              />
            ))}
          </div>
        </ScrollArea>
      </aside>

      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="space-y-4 p-4">
          <section className="rounded-md border border-border bg-muted/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">
                  {snapshot.board
                    ? localizedText(
                        snapshot.board,
                        locale,
                        "title",
                        snapshot.board.title
                      )
                    : selected.title}
                </h2>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {snapshot.board
                    ? localizedText(
                        snapshot.board,
                        locale,
                        "task",
                        snapshot.board.task
                      )
                    : selected.task || messages.archived}
                </p>
              </div>
              <Badge variant="secondary">{messages.archived}</Badge>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.44fr)_minmax(34rem,1fr)]">
            <ArchivePlan goals={archiveGoals} locale={locale} messages={messages} />
            <KanbanMatrix
              cards={cards}
              locale={locale}
              messages={messages}
              readOnly
            />
          </div>

          <section className="rounded-md border border-border p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Activity className="size-4 text-accent-cyan" />
              {messages.activity}
            </div>
            <ActivityFeed
              activities={activities.slice(0, 10)}
              locale={locale}
              messages={messages}
              timeZone={timeZone}
            />
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function ArchiveListItem({
  archive,
  isSelected,
  locale,
  messages,
  onSelect,
  timeZone,
}: {
  archive: ArchiveRecord;
  isSelected: boolean;
  locale: SupportedLocale;
  messages: DashboardMessages;
  onSelect: () => void;
  timeZone: string;
}) {
  const snapshot = readArchiveSnapshot(archive);
  const title = snapshot.board
    ? localizedText(snapshot.board, locale, "title", snapshot.board.title)
    : archive.title;
  const task = snapshot.board
    ? localizedText(snapshot.board, locale, "task", snapshot.board.task)
    : archive.task;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-md border p-3 text-left transition-colors ${
        isSelected
          ? "border-accent-cyan bg-accent-cyan/10"
          : "border-border bg-background hover:bg-muted/20"
      }`}
    >
      <div className="truncate text-sm font-medium">{title}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">
        {task || messages.archived}
      </div>
      <div className="mt-2 font-mono text-[10px] text-muted-foreground">
        {formatTime(archive.createdAt, locale, timeZone)}
      </div>
    </button>
  );
}

function PanelHeader({
  action,
  icon,
  meta,
  title,
}: {
  action?: React.ReactNode;
  icon: React.ReactNode;
  meta: string;
  title: string;
}) {
  return (
    <div className="flex h-12 items-center gap-2 border-b border-border px-4">
      <div className="text-accent-cyan">{icon}</div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="ml-auto truncate font-mono text-[11px] text-muted-foreground">
        {meta}
      </span>
      {action}
    </div>
  );
}

function PlanPanel({
  locale,
  messages,
  snapshot,
}: {
  locale: SupportedLocale;
  messages: DashboardMessages;
  snapshot: DashboardSnapshot;
}) {
  if (snapshot.goals.length === 0) {
    return (
      <div className="p-4">
        <section className="rounded-md border border-border bg-muted/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{messages.noActivePlan}</h2>
            <Badge variant="outline">{messages.empty}</Badge>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-md border border-border bg-muted/15 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">
              {localizedText(
                snapshot.board,
                locale,
                "title",
                snapshot.board.title
              )}
            </h2>
            {snapshot.board.task && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {localizedText(
                  snapshot.board,
                  locale,
                  "task",
                  snapshot.board.task
                )}
              </p>
            )}
          </div>
          <Badge variant={snapshot.board.archiveReady ? "default" : "outline"}>
            {snapshot.board.archiveReady ? messages.archiveReady : snapshot.board.status}
          </Badge>
        </div>
      </section>
      <PlanTree goals={snapshot.goals} locale={locale} messages={messages} />
    </div>
  );
}

function ArchivePlan({
  goals,
  locale,
  messages,
}: {
  goals: DashboardSnapshot["goals"];
  locale: SupportedLocale;
  messages: DashboardMessages;
}) {
  return (
    <section className="rounded-md border border-border">
      <PanelHeader
        icon={<Workflow className="size-4" />}
        meta={String(goals.length)}
        title={messages.plan}
      />
      <div className="p-4">
        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{messages.noActivePlan}</p>
        ) : (
          <PlanTree goals={goals} locale={locale} messages={messages} />
        )}
      </div>
    </section>
  );
}

function PlanTree({
  goals,
  locale,
  messages,
}: {
  goals: DashboardSnapshot["goals"];
  locale: SupportedLocale;
  messages: DashboardMessages;
}) {
  return (
    <div className="space-y-3">
      {goals.map((goal) => (
        <section key={goal.id} className="space-y-2">
          <article className="rounded-md border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">
                  {localizedText(goal, locale, "title", goal.title)}
                </h3>
                {goal.summary && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {localizedText(goal, locale, "summary", goal.summary)}
                  </p>
                )}
              </div>
              <Badge variant="secondary">{goal.status}</Badge>
            </div>
          </article>

          {goal.milestones.map((milestone) => (
            <article
              key={milestone.id}
              className="rounded-md border border-border bg-muted/10 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-xs font-semibold">
                    {localizedText(
                      milestone,
                      locale,
                      "title",
                      milestone.title === "Current work"
                        ? messages.current
                        : milestone.title
                    )}
                  </h4>
                  {milestone.summary && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      {localizedText(
                        milestone,
                        locale,
                        "summary",
                        milestone.summary
                      )}
                    </p>
                  )}
                </div>
                <PriorityBadge
                  messages={messages}
                  priority={milestone.priority as CardPriority}
                />
              </div>
              <div className="mt-3 grid gap-2">
                {milestone.cards.slice(0, 4).map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
                  >
                    <CircleDot className="size-3 text-accent-cyan" />
                    <span className="min-w-0 flex-1 truncate text-[11px]">
                      {localizedText(card, locale, "title", card.title)}
                    </span>
                    <StatusBadge messages={messages} status={card.status as CardStatus} />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

function CurrentWorkVisual({
  locale,
  messages,
  snapshot,
}: {
  locale: SupportedLocale;
  messages: DashboardMessages;
  snapshot: DashboardSnapshot;
}) {
  const latest = snapshot.activityEntries[0];
  const focusCard =
    snapshot.cards.find((card) => card.status === "doing") ??
    snapshot.cards.find((card) => card.status === "review") ??
    snapshot.cards.find((card) => card.status === "ready");
  const currentPhase = latest?.phase === "fail" ? "verify" : latest?.phase ?? "start";
  const phaseIndex = Math.max(0, phases.findIndex((phase) => phase === currentPhase));
  const progress = (phaseIndex / (phases.length - 1)) * 100;

  return (
    <section className="rounded-md border border-border bg-muted/10 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="size-4 text-accent-cyan" />
            {messages.current}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {latest
              ? localizedText(latest, locale, "message", latest.message)
              : messages.noActivity}
          </p>
        </div>
        {latest && <PhaseBadge messages={messages} phase={latest.phase} />}
      </div>

      <div className="mt-4">
        <div className="relative h-2 rounded-full bg-muted">
          <div
            className={`absolute left-0 top-0 h-2 rounded-full ${
              latest?.phase === "fail" ? "bg-risk-high" : "bg-accent-cyan"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {phases.map((phase, index) => {
            const active = index === phaseIndex;
            const complete = index < phaseIndex;

            return (
              <div
                key={phase}
                className="flex min-w-0 flex-col items-center gap-1 text-center"
              >
                <span
                  className={`flex size-7 items-center justify-center rounded-full border text-[10px] ${
                    active
                      ? "border-accent-cyan bg-accent-cyan/15 text-accent-cyan ring-4 ring-accent-cyan/20"
                      : complete
                        ? "border-status-done/40 bg-status-done/10 text-status-done"
                        : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {complete ? <CheckCircle2 className="size-3" /> : index + 1}
                </span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {messages.phase[phase]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-md border border-border bg-background p-3">
        <div className="text-[11px] text-muted-foreground">{messages.focus}</div>
        <div className="mt-1 truncate text-sm font-medium">
          {focusCard
            ? localizedText(focusCard, locale, "title", focusCard.title)
            : messages.waiting}
        </div>
        {focusCard?.summary && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {localizedText(focusCard, locale, "summary", focusCard.summary)}
          </p>
        )}
      </div>
    </section>
  );
}

function KanbanMatrix({
  cards,
  locale,
  messages,
  readOnly = false,
}: {
  cards: DashboardCard[];
  locale: SupportedLocale;
  messages: DashboardMessages;
  readOnly?: boolean;
}) {
  if (cards.length === 0) {
    return (
      <section className="rounded-md border border-border p-4 text-sm text-muted-foreground">
        {messages.noCards}
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="grid grid-cols-[7.5rem_1fr] gap-2 rounded-md border border-border bg-muted/10 p-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Workflow className="size-3.5" />
          {messages.workflow}
        </div>
        <div className="grid grid-cols-3 gap-2 font-medium text-foreground">
          {priorities.map((priority) => (
            <PriorityBadge
              key={priority}
              messages={messages}
              priority={priority}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {statuses.map((status) => (
          <KanbanRow
            key={status}
            cards={cards.filter((card) => card.status === status)}
            locale={locale}
            messages={messages}
            readOnly={readOnly}
            status={status}
          />
        ))}
      </div>
    </section>
  );
}

function KanbanRow({
  cards,
  locale,
  messages,
  readOnly,
  status,
}: {
  cards: DashboardCard[];
  locale: SupportedLocale;
  messages: DashboardMessages;
  readOnly: boolean;
  status: CardStatus;
}) {
  return (
    <div
      className={`grid min-h-32 grid-cols-[7.5rem_1fr] gap-2 rounded-md border border-border p-2 ${statusTone[status]}`}
    >
      <div className="flex flex-col justify-between rounded-md bg-background/70 p-2">
        <div>
          <StatusBadge messages={messages} status={status} />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {messages.statusHint[status]}
          </p>
        </div>
        <Badge variant="outline" className={`w-fit ${statusBadgeClass[status]}`}>
          {cards.length}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {priorities.map((priority) => (
          <KanbanCell
            key={priority}
            cards={cards.filter((card) => card.priority === priority)}
            locale={locale}
            messages={messages}
            priority={priority}
            readOnly={readOnly}
            status={status}
          />
        ))}
      </div>
    </div>
  );
}

function KanbanCell({
  cards,
  locale,
  messages,
  priority,
  readOnly,
  status,
}: {
  cards: DashboardCard[];
  locale: SupportedLocale;
  messages: DashboardMessages;
  priority: CardPriority;
  readOnly: boolean;
  status: CardStatus;
}) {
  const { setNodeRef, isOver } = useDroppable({
    disabled: readOnly,
    id: `${status}:${priority}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-24 space-y-2 rounded-md border border-dashed border-border/70 bg-background/35 p-2 ${
        isOver ? "ring-2 ring-ring" : ""
      }`}
    >
      {cards.map((card) =>
        readOnly ? (
          <StaticCard key={card.id} card={card} locale={locale} />
        ) : (
          <DraggableCard key={card.id} card={card} locale={locale} />
        )
      )}
      {cards.length === 0 && (
        <div className="flex h-14 items-center justify-center text-[11px] text-muted-foreground">
          {messages.empty}
        </div>
      )}
    </div>
  );
}

function DraggableCard({
  card,
  locale,
}: {
  card: DashboardCard;
  locale: SupportedLocale;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: card.id });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      data-card-status={card.status}
      data-card-title={card.title}
      data-testid="kanban-card"
      className={`rounded-md border border-border bg-background p-2 shadow-sm ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 text-muted-foreground"
          aria-label={dashboardMessages[locale].moveCard}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-3.5" />
        </button>
        <CardBody card={card} locale={locale} />
      </div>
    </article>
  );
}

function StaticCard({
  card,
  locale,
}: {
  card: DashboardCard;
  locale: SupportedLocale;
}) {
  return (
    <article
      data-card-status={card.status}
      data-card-title={card.title}
      data-testid="kanban-card"
      className="rounded-md border border-border bg-background p-2 shadow-sm"
    >
      <CardBody card={card} locale={locale} />
    </article>
  );
}

function CardBody({
  card,
  locale,
}: {
  card: DashboardCard;
  locale: SupportedLocale;
}) {
  return (
    <div className="min-w-0 flex-1">
      <h3 className="text-xs font-medium leading-5">
        {localizedText(card, locale, "title", card.title)}
      </h3>
      {card.summary && (
        <p className="line-clamp-3 text-[11px] leading-4 text-muted-foreground">
          {localizedText(card, locale, "summary", card.summary)}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="outline" className="text-[10px]">
          {card.size}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {card.owner}
        </Badge>
      </div>
      {card.verificationCommand && (
        <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground">
          {card.verificationCommand}
        </p>
      )}
    </div>
  );
}

function RubberDuck({
  locale,
  messages,
  onRefresh,
  suggestions,
}: {
  locale: SupportedLocale;
  messages: DashboardMessages;
  onRefresh: () => Promise<void>;
  suggestions: DuckSuggestion[];
}) {
  const [minimized, setMinimized] = React.useState(() =>
    typeof window === "undefined"
      ? false
      : window.localStorage.getItem("vibe-duck-minimized") === "1"
  );
  const [chipsVisible, setChipsVisible] = React.useState(false);
  const [burstKey, setBurstKey] = React.useState(0);
  const [selected, setSelected] = React.useState<DuckSuggestion | null>(null);
  const [copied, setCopied] = React.useState(false);
  const unreadCount = suggestions.filter((suggestion) => !suggestion.readAt).length;
  const visibleSuggestions = suggestions.slice(0, 5);

  React.useEffect(() => {
    window.localStorage.setItem("vibe-duck-minimized", minimized ? "1" : "0");
  }, [minimized]);

  async function openSuggestion(suggestion: DuckSuggestion) {
    setSelected(suggestion);
    setCopied(false);
    if (!suggestion.readAt) {
      await patchJson(`/api/duck-suggestions/${suggestion.id}`, {});
      await onRefresh();
    }
  }

  async function copyPrompt() {
    if (!selected) return;
    const prompt = localizedText(
      selected,
      locale,
      "actionPrompt",
      selected.actionPrompt || selected.detail || selected.title
    );
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function handleDuckClick() {
    if (minimized) {
      setMinimized(false);
      setChipsVisible(false);
      setBurstKey((value) => value + 1);
      return;
    }
    setChipsVisible((visible) =>
      visibleSuggestions.length > 0 ? !visible : false
    );
    setBurstKey((value) => value + 1);
  }

  if (minimized) {
    return (
      <button
        type="button"
        onClick={handleDuckClick}
        aria-label={messages.duckOpen}
        data-testid="rubber-duck-minimized"
        className="fixed bottom-4 right-4 z-40 flex size-12 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-transform hover:scale-105"
      >
        <DuckImage className="size-9 object-contain" />
        {unreadCount > 0 && <DuckBadge count={unreadCount} />}
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2"
      data-testid="rubber-duck"
    >
      {chipsVisible && visibleSuggestions.length > 0 && (
        <div className="flex max-w-[min(22rem,calc(100vw-2rem))] flex-col items-end gap-2">
          {visibleSuggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.id}-${burstKey}`}
              type="button"
              onClick={() => openSuggestion(suggestion)}
              data-testid="duck-suggestion-chip"
              className="duck-chip rounded-full border border-border bg-popover px-3 py-2 text-left text-xs font-medium text-popover-foreground shadow-lg transition-colors hover:border-accent-cyan hover:bg-accent-cyan/10"
              style={
                {
                  "--duck-chip-index": index,
                } as React.CSSProperties
              }
            >
              <span className="flex items-center gap-2">
                {!suggestion.readAt && (
                  <span className="size-1.5 rounded-full bg-risk-high" />
                )}
                {localizedText(
                  suggestion,
                  locale,
                  "keyword",
                  suggestion.keyword
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <button
          key={`duck-${burstKey}`}
          type="button"
          onClick={handleDuckClick}
          aria-label={messages.duckOpen}
          className="duck-quack flex size-20 items-center justify-center rounded-2xl border border-border bg-background/95 p-2 shadow-xl backdrop-blur transition-transform hover:scale-[1.03]"
        >
          <DuckImage className="size-16 object-contain" />
          {unreadCount > 0 && <DuckBadge count={unreadCount} />}
        </button>
        <button
          type="button"
          onClick={() => {
            setMinimized(true);
            setChipsVisible(false);
          }}
          aria-label={messages.duckMinimize}
          className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md hover:text-foreground"
        >
          <Minimize2 className="size-3.5" />
        </button>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {localizedText(selected, locale, "title", selected.title)}
                </DialogTitle>
                <DialogDescription>
                  {localizedText(selected, locale, "summary", selected.summary)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm leading-6 text-foreground">
                  {localizedText(selected, locale, "detail", selected.detail)}
                </p>
                <section className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    {messages.duckPrompt}
                  </div>
                  <p className="whitespace-pre-wrap font-mono text-xs leading-5">
                    {localizedText(
                      selected,
                      locale,
                      "actionPrompt",
                      selected.actionPrompt
                    )}
                  </p>
                </section>
              </div>
              <DialogFooter>
                <Button type="button" onClick={copyPrompt}>
                  <Copy className="size-4" />
                  {copied ? messages.duckCopied : messages.duckCopyPrompt}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DuckBadge({ count }: { count: number }) {
  return (
    <span
      data-testid="duck-unread-badge"
      className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-risk-high text-[11px] font-bold text-white shadow-md"
      aria-hidden="true"
    >
      {count > 9 ? "!" : "!"}
    </span>
  );
}

function DuckImage({ className }: { className: string }) {
  return (
    <picture>
      <source
        srcSet="/rubber-duck/rubber-duck-2d5.webp?v=alpha1"
        type="image/webp"
      />
      <img
        src="/rubber-duck/rubber-duck-2d5.png?v=alpha1"
        alt=""
        className={className}
      />
    </picture>
  );
}

function ActivitySheet({
  activities,
  cards,
  doingCount,
  locale,
  messages,
  timeZone,
}: {
  activities: DashboardActivity[];
  cards: DashboardCard[];
  doingCount: number;
  locale: SupportedLocale;
  messages: DashboardMessages;
  timeZone: string;
}) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Activity className="size-4" />
            {messages.activity}
          </Button>
        }
      />
      <SheetContent className="z-[60] w-[min(620px,96vw)] border-l border-border sm:max-w-none">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{messages.activity}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-4">
            <SummaryStrip
              activityCount={activities.length}
              cards={cards}
              doingCount={doingCount}
              messages={messages}
            />
            <ActivityFeed
              activities={activities}
              locale={locale}
              messages={messages}
              timeZone={timeZone}
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function SummaryStrip({
  activityCount,
  cards,
  doingCount,
  messages,
}: {
  activityCount: number;
  cards: DashboardCard[];
  doingCount: number;
  messages: DashboardMessages;
}) {
  const doneCount = cards.filter((card) => card.status === "done").length;

  return (
    <div className="grid grid-cols-3 gap-2">
      <MetricTile label={messages.cards} value={String(cards.length)} />
      <MetricTile label={messages.status.doing} value={String(doingCount)} />
      <MetricTile label={messages.done} value={`${doneCount}/${cards.length}`} />
      <div className="col-span-3">
        <MetricTile label={messages.activities} value={String(activityCount)} wide />
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-border bg-muted/15 p-3 ${
        wide ? "flex items-center justify-between" : ""
      }`}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}

function ActivityFeed({
  activities,
  locale,
  messages,
  timeZone,
}: {
  activities: DashboardActivity[];
  locale: SupportedLocale;
  messages: DashboardMessages;
  timeZone: string;
}) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">{messages.noActivity}</p>;
  }

  return (
    <section className="space-y-2">
      {activities.map((activity) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          locale={locale}
          messages={messages}
          timeZone={timeZone}
        />
      ))}
    </section>
  );
}

function ActivityItem({
  activity,
  locale,
  messages,
  timeZone,
}: {
  activity: DashboardActivity;
  locale: SupportedLocale;
  messages: DashboardMessages;
  timeZone: string;
}) {
  const isFail = activity.phase === "fail" || activity.status === "failed";
  const isResult = activity.phase === "result";

  return (
    <article
      className={`rounded-md border p-3 ${
        isFail
          ? "border-risk-high/30 bg-risk-high/10"
          : isResult
            ? "border-status-done/30 bg-status-done/10"
            : "border-border bg-background"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PhaseBadge messages={messages} phase={activity.phase} />
          <h3 className="mt-2 text-sm font-medium">
            {localizedText(activity, locale, "title", activity.title)}
          </h3>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatTime(activity.createdAt, locale, timeZone)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {localizedText(activity, locale, "message", activity.message)}
      </p>
    </article>
  );
}

function PhaseBadge({
  messages,
  phase,
}: {
  messages: DashboardMessages;
  phase: string;
}) {
  const icon =
    phase === "result" ? (
      <CheckCircle2 className="size-3" />
    ) : phase === "verify" ? (
      <ListChecks className="size-3" />
    ) : phase === "fail" ? (
      <CircleDot className="size-3" />
    ) : (
      <Clock3 className="size-3" />
    );

  return (
    <Badge variant={phase === "result" ? "default" : "secondary"}>
      {icon}
      {messages.phase[phase as keyof typeof messages.phase] ?? phase}
    </Badge>
  );
}

function InspectorSheet({
  messages,
  snapshot,
}: {
  messages: DashboardMessages;
  snapshot: DashboardSnapshot;
}) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Settings2 className="size-4" />
            {messages.inspector}
          </Button>
        }
      />
      <SheetContent className="z-[60] w-[min(780px,96vw)] border-l border-border sm:max-w-none">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{messages.inspector}</SheetTitle>
        </SheetHeader>
        <Inspector messages={messages} snapshot={snapshot} />
      </SheetContent>
    </Sheet>
  );
}

function Inspector({
  messages,
  snapshot,
}: {
  messages: DashboardMessages;
  snapshot: DashboardSnapshot;
}) {
  return (
    <Tabs defaultValue="repo" className="flex min-h-0 flex-1 flex-col">
      <TabsList className="mx-4 mt-3 grid grid-cols-5">
        <TabsTrigger value="repo" aria-label={messages.repo}>
          <GitBranch className="size-4" />
        </TabsTrigger>
        <TabsTrigger value="github" aria-label={messages.github}>
          <GitPullRequest className="size-4" />
        </TabsTrigger>
        <TabsTrigger value="design" aria-label={messages.design}>
          <MoonStar className="size-4" />
        </TabsTrigger>
        <TabsTrigger value="harness" aria-label="Harness">
          <Settings2 className="size-4" />
        </TabsTrigger>
        <TabsTrigger value="agents" aria-label={messages.agents}>
          <Boxes className="size-4" />
        </TabsTrigger>
      </TabsList>
      <ScrollArea className="min-h-0 flex-1">
        <TabsContent value="repo" className="m-0 p-4">
          <RepoPanel messages={messages} snapshot={snapshot} />
        </TabsContent>
        <TabsContent value="github" className="m-0 p-4">
          <GithubPanel messages={messages} snapshot={snapshot} />
        </TabsContent>
        <TabsContent value="design" className="m-0 p-4">
          <DesignPanel snapshot={snapshot} />
        </TabsContent>
        <TabsContent value="harness" className="m-0 p-4">
          <HarnessPanel messages={messages} snapshot={snapshot} />
        </TabsContent>
        <TabsContent value="agents" className="m-0 p-4">
          <SubagentPanel snapshot={snapshot} />
        </TabsContent>
      </ScrollArea>
    </Tabs>
  );
}

function RepoPanel({
  messages,
  snapshot,
}: {
  messages: DashboardMessages;
  snapshot: DashboardSnapshot;
}) {
  return (
    <div className="space-y-4">
      <MetricRow label={messages.branch} value={snapshot.repoStatus.branch} />
      <MetricRow
        label={messages.changed}
        value={String(snapshot.repoStatus.changedFiles.length)}
      />
      <Separator />
      <div className="grid gap-1">
        {snapshot.repoStatus.changedFiles.length === 0 ? (
          <p className="text-xs text-muted-foreground">{messages.empty}</p>
        ) : (
          snapshot.repoStatus.changedFiles.map((file) => (
            <div
              key={`${file.code}-${file.path}`}
              className="flex items-center gap-2 rounded-md border border-border px-2 py-1 font-mono text-xs"
            >
              <Badge variant="outline">{file.code}</Badge>
              <span className="truncate">{file.path}</span>
            </div>
          ))
        )}
      </div>
      <Separator />
      <div className="grid gap-1">
        {snapshot.workspaceFiles.slice(0, 28).map((file) => (
          <span
            key={file}
            className="truncate font-mono text-xs text-muted-foreground"
          >
            {file}
          </span>
        ))}
      </div>
    </div>
  );
}

function GithubPanel({
  messages,
  snapshot,
}: {
  messages: DashboardMessages;
  snapshot: DashboardSnapshot;
}) {
  return (
    <div className="space-y-4">
      <MetricRow
        label={messages.auth}
        value={snapshot.githubStatus.authenticated ? "ok" : "missing"}
      />
      <MetricRow
        label={messages.repo}
        value={snapshot.githubStatus.repo.nameWithOwner ?? messages.linkedMissing}
      />
      <pre className="max-h-72 overflow-auto rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        {snapshot.githubStatus.authText || messages.empty}
      </pre>
    </div>
  );
}

function DesignPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="space-y-3">
      {snapshot.designTokens.map((token) => (
        <article
          key={token.id}
          className="rounded-md border border-border bg-muted/10 p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-mono text-xs font-semibold">{token.name}</h3>
              <p className="font-mono text-[11px] text-muted-foreground">
                {token.value}
              </p>
            </div>
            <Sparkles className="size-4 text-accent-cyan" />
          </div>
          <div className="mt-2 flex gap-1">
            <Badge variant="secondary">{token.category}</Badge>
            <Badge variant="outline">{token.scope}</Badge>
            <Badge variant="outline">{token.status}</Badge>
          </div>
        </article>
      ))}
    </div>
  );
}

function HarnessPanel({
  messages,
  snapshot,
}: {
  messages: DashboardMessages;
  snapshot: DashboardSnapshot;
}) {
  return (
    <div className="space-y-4">
      <MetricRow label={messages.launch} value={snapshot.launch.command} />

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-accent-cyan" />
          {messages.skills}
        </div>
        {snapshot.harnessInventory.skills.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
            {messages.empty}
          </p>
        ) : (
          snapshot.harnessInventory.skills.map((skill) => (
            <article
              key={skill.id}
              className="rounded-md border border-border bg-muted/10 p-3"
            >
              <h3 className="truncate text-sm font-medium">{skill.name}</h3>
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                {skill.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge variant="secondary">{skill.filePath}</Badge>
                {skill.hasOpenAiYaml && (
                  <Badge variant="outline">openai.yaml</Badge>
                )}
                <Badge variant="outline">
                  {messages.references} {skill.references}
                </Badge>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Settings2 className="size-4 text-accent-cyan" />
          MCP
        </div>
        {snapshot.harnessInventory.mcpServers.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
            {messages.empty}
          </p>
        ) : (
          snapshot.harnessInventory.mcpServers.map((server) => (
            <article
              key={`${server.source}-${server.name}`}
              className="rounded-md border border-border bg-muted/10 p-3"
            >
              <h3 className="truncate text-sm font-medium">{server.name}</h3>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {server.url || messages.empty}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge variant={server.enabled ? "secondary" : "outline"}>
                  {server.enabled ? messages.enabled : messages.disabled}
                </Badge>
                <Badge variant="outline">{server.source}</Badge>
                <Badge variant="outline">{server.filePath}</Badge>
              </div>
            </article>
          ))
        )}
      </section>

      {snapshot.harnessProfiles.map((profile) => (
        <article
          key={profile.id}
          className="rounded-md border border-border bg-muted/10 p-3"
        >
          <h3 className="text-sm font-medium">{profile.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {profile.description}
          </p>
        </article>
      ))}
    </div>
  );
}

function SubagentPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="space-y-3">
      {snapshot.subagents.map((agent) => (
        <article
          key={agent.id}
          className="rounded-md border border-border bg-muted/10 p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">{agent.name}</h3>
              <p className="text-xs text-muted-foreground">
                {agent.description}
              </p>
            </div>
            <Bot className="size-4 text-accent-cyan" />
          </div>
          <div className="mt-3 grid gap-1 font-mono text-[11px] text-muted-foreground">
            <span>{agent.filePath}</span>
            <span>
              {agent.model} / {agent.reasoningEffort} / {agent.sandbox}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-xs">{value}</span>
    </div>
  );
}

function IconTip({
  children,
  label,
}: {
  children: React.ReactElement;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
