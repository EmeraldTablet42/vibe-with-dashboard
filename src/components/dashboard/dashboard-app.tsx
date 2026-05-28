"use client";

import * as React from "react";
import {
  Activity,
  Bot,
  Boxes,
  CheckCircle2,
  CircleDot,
  Clock3,
  Code2,
  GitBranch,
  GitPullRequest,
  GripVertical,
  LayoutDashboard,
  ListChecks,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import type { CardPriority, CardStatus } from "@/lib/types";

const statusRows: Array<{
  id: CardStatus;
  label: string;
  hint: string;
  color: string;
}> = [
  {
    id: "backlog",
    label: "Backlog",
    hint: "아직 실행하지 않음",
    color: "bg-muted/20",
  },
  {
    id: "ready",
    label: "Ready",
    hint: "바로 투입 가능",
    color: "bg-status-ready/15",
  },
  {
    id: "doing",
    label: "Doing",
    hint: "현재 처리 중",
    color: "bg-status-running/15",
  },
  {
    id: "review",
    label: "Review",
    hint: "검토와 확인 필요",
    color: "bg-status-review/15",
  },
  {
    id: "done",
    label: "Done",
    hint: "검증 후 완료",
    color: "bg-status-done/15",
  },
];

const priorityColumns: Array<{
  id: CardPriority;
  label: string;
  hint: string;
}> = [
  { id: "high", label: "High", hint: "먼저 볼 것" },
  { id: "medium", label: "Medium", hint: "일반 흐름" },
  { id: "low", label: "Low", hint: "나중에" },
];

const phaseLabels: Record<string, string> = {
  start: "Start",
  plan: "Plan",
  implement: "Implement",
  verify: "Verify",
  result: "Result",
  fail: "Fail",
};

const DEFAULT_PLAN_WIDTH = 360;
const MIN_PLAN_WIDTH = 280;
const MAX_PLAN_WIDTH = 560;

function formatKstTime(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("hour")}:${get("minute")}:${get("second")}`;
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

export function DashboardApp({
  initialSnapshot,
}: {
  initialSnapshot: DashboardSnapshot;
}) {
  const [snapshot, setSnapshot] = React.useState(initialSnapshot);
  const [planOpen, setPlanOpen] = React.useState(true);
  const [planWidth, setPlanWidth] = React.useState(DEFAULT_PLAN_WIDTH);

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

    if (
      !statusRows.some((row) => row.id === status) ||
      !priorityColumns.some((column) => column.id === priority)
    ) {
      return;
    }

    await patchJson(`/api/cards/${cardId}`, { status, priority });
    await refresh();
  }

  function openPlanSidebar() {
    setPlanWidth(DEFAULT_PLAN_WIDTH);
    setPlanOpen(true);
  }

  function closePlanSidebar() {
    setPlanOpen(false);
  }

  function startPlanResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = planWidth;

    const move = (moveEvent: PointerEvent) => {
      const next = Math.min(
        MAX_PLAN_WIDTH,
        Math.max(MIN_PLAN_WIDTH, startWidth + moveEvent.clientX - startX)
      );
      setPlanWidth(next);
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
    <main className="flex min-h-screen flex-col bg-background text-foreground">
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

        <div className="ml-auto flex items-center gap-2">
          <StatusPill
            icon={<SquareKanban className="size-3.5" />}
            label="monitoring"
            tone="info"
          />
          <StatusPill
            icon={<Bot className="size-3.5" />}
            label="$vibe-with-dashboard"
            tone="good"
          />
          {!planOpen && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={openPlanSidebar}
                    aria-label="Plan 열기"
                  >
                    <PanelLeftOpen className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>Plan 열기</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={refresh}
                  aria-label="새로고침"
                >
                  <RefreshCw className="size-4" />
                </Button>
              }
            />
            <TooltipContent>새로고침</TooltipContent>
          </Tooltip>
          <ThemeToggle />
          <Sheet>
            <SheetTrigger
              render={
                <Button type="button" variant="outline" size="sm">
                  <Activity className="size-4" />
                  Activity
                </Button>
              }
            />
            <SheetContent className="z-[60] w-[min(620px,96vw)] border-l border-border sm:max-w-none">
              <SheetHeader className="border-b border-border">
                <SheetTitle>Activity Timeline</SheetTitle>
                <SheetDescription>
                  Agent 작업 단계와 dashboard 기록.
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-4 p-4">
                  <SummaryStrip
                    cards={snapshot.cards}
                    doingCount={doingCards.length}
                    activityCount={snapshot.activityEntries.length}
                  />
                  <ActivityFeed activities={snapshot.activityEntries} />
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger
              render={
                <Button type="button" variant="outline" size="sm">
                  <Settings2 className="size-4" />
                  Inspector
                </Button>
              }
            />
            <SheetContent className="z-[60] w-[min(780px,96vw)] border-l border-border sm:max-w-none">
              <SheetHeader className="border-b border-border">
                <SheetTitle>Inspector</SheetTitle>
                <SheetDescription>
                  Repo, GitHub, design, harness, skills, MCP, subagents snapshot.
                </SheetDescription>
              </SheetHeader>
              <Inspector snapshot={snapshot} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {planOpen ? (
          <section
            data-testid="plan-sidebar"
            className="relative min-h-0 shrink-0 border-r border-border bg-background"
            style={{ width: planWidth }}
          >
          <PanelHeader
            icon={<Workflow className="size-4" />}
            title="Plan"
            meta={snapshot.board.isEmpty ? "empty" : `${snapshot.goals.length} goals`}
            action={
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={closePlanSidebar}
                      aria-label="Plan 접기"
                    >
                      <PanelLeftClose className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent>Plan 접기</TooltipContent>
              </Tooltip>
            }
          />
          <ScrollArea className="h-[calc(100vh-7.5rem)]">
            <PlanPanel snapshot={snapshot} />
          </ScrollArea>
          </section>
        ) : (
          <button
            type="button"
            onClick={openPlanSidebar}
            className="flex w-11 shrink-0 items-center justify-center border-r border-border bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground"
            aria-label="Plan 열기"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        )}

        {planOpen && (
          <button
            type="button"
            aria-label="Plan 폭 조절"
            onPointerDown={startPlanResize}
            className="z-10 w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-accent-cyan/40 focus-visible:bg-accent-cyan/50 focus-visible:outline-none"
          />
        )}

        <section className="min-w-0 flex-1 border-b border-border xl:border-b-0">
          <PanelHeader
            icon={<SquareKanban className="size-4" />}
            title="Kanban"
            meta={
              snapshot.board.archiveReady
                ? "archive ready"
                : "현재 처리 지점 + 세로 실행 단계"
            }
          />
          <ScrollArea className="h-[calc(100vh-7.5rem)]">
            <div className="space-y-4 p-4">
              <CurrentWorkVisual snapshot={snapshot} />
              <DndContext id="dashboard-kanban" onDragEnd={handleDragEnd}>
                <KanbanMatrix cards={snapshot.cards} />
              </DndContext>
            </div>
          </ScrollArea>
        </section>
      </div>
    </main>
  );
}

function PanelHeader({
  icon,
  title,
  meta,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  action?: React.ReactNode;
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

function StatusPill({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "good" | "info" | "muted";
}) {
  const className =
    tone === "good"
      ? "border-status-done/30 bg-status-done/10 text-status-done"
      : tone === "info"
        ? "border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan"
        : "border-border bg-muted/40 text-muted-foreground";

  return (
    <span
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}

function PlanPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  if (snapshot.goals.length === 0) {
    return (
      <div className="space-y-4 p-4">
        <section className="rounded-md border border-border bg-muted/15 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">활성 계획 없음</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                `$vibe-with-dashboard plan --task ...`가 실행되면 현재 작업의
                goal, milestone, card가 여기에 나타난다.
              </p>
            </div>
            <Badge variant="outline">empty</Badge>
          </div>
        </section>
        <section className="rounded-md border border-border bg-background p-3">
          <div className="text-xs font-semibold">Archive</div>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            완료된 board는 archive 후 active board에서 사라진다.
          </p>
          <Badge variant="secondary" className="mt-3">
            {snapshot.archives.length} archived
          </Badge>
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
              {snapshot.board.title}
            </h2>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {snapshot.board.task || "현재 board task 없음"}
            </p>
          </div>
          <Badge variant={snapshot.board.archiveReady ? "default" : "outline"}>
            {snapshot.board.archiveReady ? "archive ready" : snapshot.board.status}
          </Badge>
        </div>
      </section>
      {snapshot.goals.map((goal) => (
        <section key={goal.id} className="space-y-3">
          <div className="rounded-md border border-border bg-muted/15 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">{goal.title}</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {goal.summary}
                </p>
              </div>
              <Badge variant="secondary">{goal.status}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            {goal.milestones.map((milestone) => (
              <article
                key={milestone.id}
                className="rounded-md border border-border bg-background p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold">{milestone.title}</h3>
                    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                      {milestone.summary}
                    </p>
                  </div>
                  <Badge variant="outline">{milestone.priority}</Badge>
                </div>
                <div className="mt-3 grid gap-2">
                  {milestone.cards.slice(0, 4).map((card) => (
                    <div
                      key={card.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-muted/10 px-2 py-1.5"
                    >
                      <CircleDot className="size-3 text-accent-cyan" />
                      <span className="min-w-0 flex-1 truncate text-[11px]">
                        {card.title}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {card.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CurrentWorkVisual({ snapshot }: { snapshot: DashboardSnapshot }) {
  const latest = snapshot.activityEntries[0];
  const doing = snapshot.cards.find((card) => card.status === "doing");
  const review = snapshot.cards.find((card) => card.status === "review");
  const focusCard = doing ?? review ?? snapshot.cards.find((card) => card.status === "ready");
  const phases = ["start", "plan", "implement", "verify", "result"] as const;
  const currentPhase = latest?.phase === "fail" ? "verify" : latest?.phase ?? "start";
  const phaseIndex = Math.max(
    0,
    phases.findIndex((phase) => phase === currentPhase)
  );
  const progress = phases.length > 1 ? (phaseIndex / (phases.length - 1)) * 100 : 0;

  return (
    <section className="rounded-md border border-border bg-muted/10 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="size-4 text-accent-cyan" />
            현재 처리 지점
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
      {latest
              ? latest.message
              : "아직 기록된 activity가 없다. $vibe-with-dashboard 작업이 시작되면 여기에 표시된다."}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {latest && <PhaseBadge phase={latest.phase} />}
          {latest?.task && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {latest.task}
            </Badge>
          )}
        </div>
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
                  {phaseLabels[phase]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-[11px] text-muted-foreground">Focus card</div>
          <div className="mt-1 truncate text-sm font-medium">
            {focusCard?.title ?? "대기 중"}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {focusCard?.summary ?? "Doing 또는 Review 카드가 생기면 자동으로 잡힌다."}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 md:w-56">
          <MetricTile
            label="Doing"
            value={String(snapshot.cards.filter((card) => card.status === "doing").length)}
          />
          <MetricTile
            label="Review"
            value={String(snapshot.cards.filter((card) => card.status === "review").length)}
          />
          <MetricTile
            label="Done"
            value={String(snapshot.cards.filter((card) => card.status === "done").length)}
          />
        </div>
      </div>
    </section>
  );
}

function KanbanMatrix({ cards }: { cards: DashboardCard[] }) {
  return (
    <section className="space-y-2">
      <div className="grid grid-cols-[7.5rem_1fr] gap-2 rounded-md border border-border bg-muted/10 p-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Workflow className="size-3.5" />
          실행 단계
        </div>
        <div className="grid grid-cols-3 gap-2">
          {priorityColumns.map((priority) => (
            <div key={priority.id} className="flex items-center justify-between">
              <span className="font-medium text-foreground">{priority.label}</span>
              <span>{priority.hint}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {statusRows.map((row) => (
          <KanbanRow
            key={row.id}
            row={row}
            cards={cards.filter((card) => card.status === row.id)}
          />
        ))}
      </div>
    </section>
  );
}

function KanbanRow({
  row,
  cards,
}: {
  row: (typeof statusRows)[number];
  cards: DashboardCard[];
}) {
  return (
    <div
      className={`grid min-h-36 grid-cols-[7.5rem_1fr] gap-2 rounded-md border border-border p-2 ${row.color}`}
    >
      <div className="flex flex-col justify-between rounded-md bg-background/70 p-2">
        <div>
          <span className="text-xs font-semibold">{row.label}</span>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {row.hint}
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {cards.length}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {priorityColumns.map((priority) => (
          <KanbanCell
            key={priority.id}
            status={row.id}
            priority={priority.id}
            cards={cards.filter((card) => card.priority === priority.id)}
          />
        ))}
      </div>
    </div>
  );
}

function KanbanCell({
  status,
  priority,
  cards,
}: {
  status: CardStatus;
  priority: CardPriority;
  cards: DashboardCard[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${status}:${priority}` });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-28 space-y-2 rounded-md border border-dashed border-border/70 bg-background/35 p-2 ${
        isOver ? "ring-2 ring-ring" : ""
      }`}
    >
      {cards.map((card) => (
        <DraggableCard key={card.id} card={card} />
      ))}
      {cards.length === 0 && (
        <div className="flex h-16 items-center justify-center text-[11px] text-muted-foreground">
          비어 있음
        </div>
      )}
    </div>
  );
}

function DraggableCard({ card }: { card: DashboardCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: card.id,
    });
  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-md border border-border bg-background p-2 shadow-sm ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 text-muted-foreground"
          aria-label="카드 이동"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-medium leading-5">{card.title}</h3>
          <p className="line-clamp-3 text-[11px] leading-4 text-muted-foreground">
            {card.summary}
          </p>
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
      </div>
    </article>
  );
}

function SummaryStrip({
  cards,
  doingCount,
  activityCount,
}: {
  cards: DashboardCard[];
  doingCount: number;
  activityCount: number;
}) {
  const doneCount = cards.filter((card) => card.status === "done").length;

  return (
    <div className="grid grid-cols-3 gap-2">
      <MetricTile label="Cards" value={String(cards.length)} />
      <MetricTile label="Doing" value={String(doingCount)} />
      <MetricTile label="Done" value={`${doneCount}/${cards.length}`} />
      <div className="col-span-3">
        <MetricTile label="Activities" value={String(activityCount)} wide />
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

function ActivityFeed({ activities }: { activities: DashboardActivity[] }) {
  return (
    <section className="space-y-2">
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </section>
  );
}

function ActivityItem({ activity }: { activity: DashboardActivity }) {
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
          <div className="flex flex-wrap items-center gap-2">
            <PhaseBadge phase={activity.phase} />
            {activity.task && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {activity.task}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-sm font-medium">{activity.title}</h3>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatKstTime(activity.createdAt)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {activity.message}
      </p>
      <div className="mt-3 flex flex-wrap gap-1">
        <Badge variant="outline" className="text-[10px]">
          {activity.source}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {activity.status}
        </Badge>
      </div>
    </article>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
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
      {phaseLabels[phase] ?? phase}
    </Badge>
  );
}

function Inspector({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <Tabs defaultValue="repo" className="flex min-h-0 flex-1 flex-col">
      <TabsList className="mx-4 mt-3 grid grid-cols-5">
        <TabsTrigger value="repo" aria-label="Repo">
          <GitBranch className="size-4" />
        </TabsTrigger>
        <TabsTrigger value="github" aria-label="GitHub">
          <GitPullRequest className="size-4" />
        </TabsTrigger>
        <TabsTrigger value="design" aria-label="Design">
          <MoonStar className="size-4" />
        </TabsTrigger>
        <TabsTrigger value="harness" aria-label="Harness">
          <Settings2 className="size-4" />
        </TabsTrigger>
        <TabsTrigger value="agents" aria-label="Agents">
          <Boxes className="size-4" />
        </TabsTrigger>
      </TabsList>
      <ScrollArea className="min-h-0 flex-1">
        <TabsContent value="repo" className="m-0 p-4">
          <RepoPanel snapshot={snapshot} />
        </TabsContent>
        <TabsContent value="github" className="m-0 p-4">
          <GithubPanel snapshot={snapshot} />
        </TabsContent>
        <TabsContent value="design" className="m-0 p-4">
          <DesignPanel snapshot={snapshot} />
        </TabsContent>
        <TabsContent value="harness" className="m-0 p-4">
          <HarnessPanel snapshot={snapshot} />
        </TabsContent>
        <TabsContent value="agents" className="m-0 p-4">
          <SubagentPanel snapshot={snapshot} />
        </TabsContent>
      </ScrollArea>
    </Tabs>
  );
}

function RepoPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="space-y-4">
      <MetricRow label="branch" value={snapshot.repoStatus.branch} />
      <MetricRow
        label="changed"
        value={String(snapshot.repoStatus.changedFiles.length)}
      />
      <Separator />
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Changed files</h3>
        {snapshot.repoStatus.changedFiles.length === 0 ? (
          <p className="text-xs text-muted-foreground">변경 없음</p>
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
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Workspace</h3>
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
    </div>
  );
}

function GithubPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="space-y-4">
      <MetricRow
        label="auth"
        value={snapshot.githubStatus.authenticated ? "ok" : "missing"}
      />
      <MetricRow
        label="repo"
        value={snapshot.githubStatus.repo.nameWithOwner ?? "not linked"}
      />
      <pre className="max-h-72 overflow-auto rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        {snapshot.githubStatus.authText || "gh auth status 없음"}
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

function HarnessPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/10 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Code2 className="size-4 text-accent-cyan" />
          Launch
        </div>
        <p className="break-all font-mono text-xs text-muted-foreground">
          {snapshot.launch.command}
        </p>
      </div>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-accent-cyan" />
          Repo Skills
        </div>
        {snapshot.harnessInventory.skills.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
            `.agents/skills` 안에 repo-local skill 없음
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
                <Badge variant="outline">refs {skill.references}</Badge>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Settings2 className="size-4 text-accent-cyan" />
          MCP Config
        </div>
        {snapshot.harnessInventory.mcpServers.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
            project-local MCP server 없음
          </p>
        ) : (
          snapshot.harnessInventory.mcpServers.map((server) => (
            <article
              key={`${server.source}-${server.name}`}
              className="rounded-md border border-border bg-muted/10 p-3"
            >
              <h3 className="truncate text-sm font-medium">{server.name}</h3>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {server.url || "url 없음"}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge variant={server.enabled ? "secondary" : "outline"}>
                  {server.enabled ? "enabled" : "disabled"}
                </Badge>
                <Badge variant="outline">{server.source}</Badge>
                <Badge variant="outline">{server.filePath}</Badge>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Code2 className="size-4 text-accent-cyan" />
          Harness Files
        </div>
        <div className="grid gap-2">
          {snapshot.harnessInventory.configFiles.map((file) => (
            <div
              key={file.path}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/10 px-3 py-2"
            >
              <span className="truncate font-mono text-xs">{file.path}</span>
              <Badge variant={file.exists ? "secondary" : "outline"}>
                {file.exists ? "present" : "missing"}
              </Badge>
            </div>
          ))}
        </div>
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
          <div className="mt-3 flex flex-wrap gap-1">
            {profile.skills.map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
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
