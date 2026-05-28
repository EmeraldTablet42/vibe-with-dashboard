"use client";

import * as React from "react";
import {
  Activity,
  Bell,
  Bot,
  Boxes,
  CheckCircle2,
  CircleDot,
  Code2,
  GitBranch,
  GitPullRequest,
  GripVertical,
  LayoutDashboard,
  ListChecks,
  Loader2,
  MoonStar,
  PauseCircle,
  Play,
  Power,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  DashboardCard,
  DashboardDecision,
  DashboardEvent,
  DashboardRun,
  DashboardSnapshot,
} from "@/lib/dashboard-types";
import type { CardStatus, RunMode } from "@/lib/types";

const columns: Array<{ id: CardStatus; label: string; color: string }> = [
  { id: "backlog", label: "Backlog", color: "bg-muted" },
  { id: "ready", label: "Ready", color: "bg-status-ready/20" },
  { id: "doing", label: "Doing", color: "bg-status-running/20" },
  { id: "review", label: "Review", color: "bg-status-review/20" },
  { id: "done", label: "Done", color: "bg-status-done/20" },
];

const statusLabels: Record<string, string> = {
  queued: "대기",
  running: "진행",
  waiting_approval: "승인대기",
  completed: "완료",
  failed: "실패",
  cancelled: "취소",
};

const priorityColumns = [
  { id: "high", label: "High", hint: "먼저 볼 것" },
  { id: "medium", label: "Medium", hint: "일반 흐름" },
  { id: "low", label: "Low", hint: "나중에" },
];

const modeDetails: Record<
  RunMode,
  { label: string; short: string; detail: string; cadence: string }
> = {
  standard: {
    label: "Standard",
    short: "단일 작업",
    detail: "작은 구현, 점검, 수정처럼 한 번에 끝나는 Run.",
    cadence: "Codex가 한 Run을 처리하고 결과를 보고한 뒤 대기.",
  },
  long: {
    label: "Long",
    short: "장기 수행",
    detail: "완료 조건까지 여러 단계로 계속 진행할 큰 작업.",
    cadence: "중간 progress/decision을 남기며 완료 전까지 heartbeat 유지.",
  },
  plan: {
    label: "Plan",
    short: "계획 수립",
    detail: "코드 변경보다 설계, 마일스톤, 작업 분해가 필요한 요청.",
    cadence: "실행 계획과 다음 Run 후보를 만들고 대기.",
  },
};

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

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
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
  const [prompt, setPrompt] = React.useState("");
  const [mode, setMode] = React.useState<RunMode>("standard");
  const [busy, setBusy] = React.useState(false);
  const [noticeEnabled, setNoticeEnabled] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const response = await fetch("/api/dashboard/snapshot", {
      cache: "no-store",
    });
    setSnapshot(await response.json());
  }, []);

  React.useEffect(() => {
    const source = new EventSource("/api/events/stream");
    source.onmessage = async (message) => {
      const event = JSON.parse(message.data) as { kind?: string; message?: string };
      await refresh();
      if (
        event.kind === "decision" &&
        noticeEnabled &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Dashboard Decision", {
          body: event.message ?? "새 결정 요청",
        });
      }
    };

    return () => source.close();
  }, [noticeEnabled, refresh]);

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNoticeEnabled(permission === "granted");
  }

  async function submitRun(event: React.FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      await postJson("/api/runs", {
        prompt,
        mode,
        riskLevel: mode === "long" ? "normal" : "low",
      });
      setPrompt("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const cardId = String(event.active.id);
    const status = event.over?.id as CardStatus | undefined;
    if (!status || !columns.some((column) => column.id === status)) return;
    await patchJson(`/api/cards/${cardId}`, { status });
    await refresh();
  }

  async function shutdown() {
    setBusy(true);
    try {
      await postJson("/api/shutdown");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const activeSession = snapshot.sessions[0];
  const shutdownRequested = snapshot.settings.shutdown_requested === "true";
  const openDecisions = snapshot.decisions.filter(
    (decision) => decision.status === "open"
  );

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          <LayoutDashboard className="size-5 text-accent-cyan" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">
              My Project Dashboard
            </h1>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {snapshot.launch.mcpUrl}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <StatusPill
            icon={<Bot className="size-3.5" />}
            label={activeSession?.status ?? "offline"}
            tone={activeSession?.status === "online" ? "good" : "muted"}
          />
          <StatusPill
            icon={<Activity className="size-3.5" />}
            label={shutdownRequested ? "stopping" : "loop ready"}
            tone={shutdownRequested ? "warn" : "info"}
          />
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
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={enableNotifications}
                  aria-label="브라우저 알림"
                >
                  <Bell className="size-4" />
                </Button>
              }
            />
            <TooltipContent>브라우저 알림</TooltipContent>
          </Tooltip>
          <ThemeToggle />
          <Sheet>
            <SheetTrigger
              render={
                <Button type="button" variant="outline" size="sm">
                  <Settings2 className="size-4" />
                  Inspector
                </Button>
              }
            />
            <SheetContent className="z-[60] w-[min(760px,96vw)] border-l border-border sm:max-w-none">
              <SheetHeader className="border-b border-border">
                <SheetTitle>Inspector</SheetTitle>
                <SheetDescription>
                  Repo, GitHub, design token, harness, subagent 세부 정보.
                </SheetDescription>
              </SheetHeader>
              <Inspector snapshot={snapshot} onChange={refresh} />
            </SheetContent>
          </Sheet>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={shutdown}
            disabled={busy || shutdownRequested}
          >
            <Power className="size-4" />
            종료
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(430px,0.98fr)_minmax(520px,1.02fr)]">
        <section className="min-h-0 border-b border-border lg:border-r lg:border-b-0">
          <PanelHeader
            icon={<SquareKanban className="size-4" />}
            title="Plan / Kanban"
            meta={`${snapshot.cards.length} cards`}
          />
          <ScrollArea className="h-[calc(100vh-7.5rem)]">
            <div className="space-y-4 p-4">
              {snapshot.goals.map((goal) => (
                <div key={goal.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">{goal.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {goal.summary}
                      </p>
                    </div>
                    <Badge variant="secondary">{goal.status}</Badge>
                  </div>
                  <div className="grid gap-2">
                    {goal.milestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="rounded-md border border-border bg-muted/20 p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">
                            {milestone.title}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {milestone.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <DndContext id="dashboard-kanban" onDragEnd={handleDragEnd}>
                <KanbanMatrix cards={snapshot.cards} />
              </DndContext>
            </div>
          </ScrollArea>
        </section>

        <section className="min-h-0">
          <PanelHeader
            icon={<Workflow className="size-4" />}
            title="Live Session"
            meta={`${openDecisions.length} decisions`}
          />
          <ScrollArea className="h-[calc(100vh-7.5rem)]">
            <div className="space-y-4 p-4">
              <form onSubmit={submitRun} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-xs text-muted-foreground">
                    선택 모드{" "}
                    <span className="font-medium text-foreground">
                      {modeDetails[mode].label}
                    </span>
                    <span> · {modeDetails[mode].short}</span>
                  </div>
                  <Button type="submit" disabled={busy || !prompt.trim()}>
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Run
                  </Button>
                </div>
                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Codex에게 보낼 다음 작업..."
                  className="min-h-28 resize-none"
                />
                <ModeGuide mode={mode} onModeChange={setMode} />
              </form>

              <DecisionQueue
                decisions={openDecisions}
                onChange={refresh}
              />

              <RunList runs={snapshot.runs} />
              <EventFeed events={snapshot.events} />
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
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
}) {
  return (
    <div className="flex h-12 items-center gap-2 border-b border-border px-4">
      <div className="text-accent-cyan">{icon}</div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="ml-auto font-mono text-[11px] text-muted-foreground">
        {meta}
      </span>
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
  tone: "good" | "warn" | "info" | "muted";
}) {
  const className =
    tone === "good"
      ? "border-status-done/30 bg-status-done/10 text-status-done"
      : tone === "warn"
        ? "border-risk-high/30 bg-risk-high/10 text-risk-high"
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

function KanbanMatrix({ cards }: { cards: DashboardCard[] }) {
  return (
    <section className="space-y-2">
      <div className="grid grid-cols-[7rem_1fr] gap-2 rounded-md border border-border bg-muted/10 p-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Workflow className="size-3.5" />
          세로축: 실행 단계
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
        {columns.map((column) => (
          <KanbanRow
            key={column.id}
            column={column}
            cards={cards.filter((card) => card.status === column.id)}
          />
        ))}
      </div>
    </section>
  );
}

function KanbanRow({
  column,
  cards,
}: {
  column: (typeof columns)[number];
  cards: DashboardCard[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`grid min-h-36 grid-cols-[7rem_1fr] gap-2 rounded-md border border-border p-2 ${column.color} ${
        isOver ? "ring-2 ring-ring" : ""
      }`}
    >
      <div className="flex flex-col justify-between rounded-md bg-background/65 p-2">
        <div>
          <span className="text-xs font-semibold">{column.label}</span>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {column.id === "backlog" && "아직 실행 안 함"}
            {column.id === "ready" && "바로 투입 가능"}
            {column.id === "doing" && "현재 처리 중"}
            {column.id === "review" && "검토/승인 필요"}
            {column.id === "done" && "완료됨"}
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {cards.length}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {priorityColumns.map((priority) => {
          const priorityCards = cards.filter(
            (card) => card.priority === priority.id
          );

          return (
            <div key={priority.id} className="min-h-28 space-y-2">
              {priorityCards.map((card) => (
                <DraggableCard key={card.id} card={card} />
              ))}
              {priorityCards.length === 0 && (
                <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-border bg-background/40 text-[11px] text-muted-foreground">
                  비어 있음
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModeGuide({
  mode,
  onModeChange,
}: {
  mode: RunMode;
  onModeChange: (mode: RunMode) => void;
}) {
  const current = modeDetails[mode];

  return (
    <div className="grid gap-2 rounded-md border border-border bg-muted/15 p-3 md:grid-cols-[10rem_1fr]">
      <div>
        <div className="text-xs font-semibold">
          {current.label} · {current.short}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {current.cadence}
        </p>
      </div>
      <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
        {(["standard", "long", "plan"] as const).map((item) => (
          <button
            type="button"
            key={item}
            aria-pressed={item === mode}
            onClick={() => onModeChange(item)}
            className={`min-h-14 rounded-md border p-2 text-left transition hover:border-accent-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              item === mode
                ? "border-accent-cyan/50 bg-accent-cyan/10 text-foreground"
                : "border-border bg-background/60"
            }`}
          >
            <div className="font-medium">{modeDetails[item].label}</div>
            <div>{modeDetails[item].short}</div>
          </button>
        ))}
      </div>
      <p className="md:col-span-2 text-xs text-muted-foreground">
        {current.detail}
      </p>
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
              {card.priority}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {card.owner}
            </Badge>
          </div>
        </div>
      </div>
    </article>
  );
}

function DecisionQueue({
  decisions,
  onChange,
}: {
  decisions: DashboardDecision[];
  onChange: () => Promise<void>;
}) {
  async function resolve(id: string, status: "approved" | "rejected") {
    await patchJson(`/api/decisions/${id}`, { status });
    await onChange();
  }

  if (decisions.length === 0) {
    return (
      <section className="rounded-md border border-border bg-muted/20 p-3">
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4 text-status-done" />
          승인 대기 없음
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <PauseCircle className="size-4 text-status-review" />
        Decision Queue
      </div>
      {decisions.map((decision) => (
        <article
          key={decision.id}
          className="rounded-md border border-status-review/30 bg-status-review/10 p-3"
        >
          <h3 className="text-sm font-medium">{decision.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{decision.body}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => resolve(decision.id, "approved")}>
              <CheckCircle2 className="size-4" />
              승인
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolve(decision.id, "rejected")}
            >
              보류
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}

function RunList({ runs }: { runs: DashboardRun[] }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ListChecks className="size-4 text-accent-cyan" />
        Runs
      </div>
      <div className="space-y-2">
        {runs.map((run) => (
          <article
            key={run.id}
            className="rounded-md border border-border bg-muted/10 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium">{run.title}</h3>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {run.prompt}
                </p>
              </div>
              <RunBadge status={run.status} />
            </div>
            <div className="mt-2 flex gap-2 font-mono text-[11px] text-muted-foreground">
              <span>{run.mode}</span>
              <span>{run.riskLevel}</span>
              <span>{formatKstTime(run.createdAt)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RunBadge({ status }: { status: string }) {
  const icon =
    status === "running" ? (
      <Loader2 className="size-3 animate-spin" />
    ) : status === "completed" ? (
      <CheckCircle2 className="size-3" />
    ) : (
      <CircleDot className="size-3" />
    );

  return (
    <Badge variant={status === "completed" ? "default" : "secondary"}>
      {icon}
      {statusLabels[status] ?? status}
    </Badge>
  );
}

function EventFeed({ events }: { events: DashboardEvent[] }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Activity className="size-4 text-status-running" />
        Event Log
      </div>
      <div className="space-y-2">
        {events.slice(0, 18).map((event) => (
          <article
            key={event.id}
            className="rounded-md border border-border bg-background p-2"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium">{event.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {formatKstTime(event.createdAt)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {event.message}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Inspector({
  snapshot,
  onChange,
}: {
  snapshot: DashboardSnapshot;
  onChange: () => Promise<void>;
}) {
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
          <DesignPanel snapshot={snapshot} onChange={onChange} />
        </TabsContent>
        <TabsContent value="harness" className="m-0 p-4">
          <HarnessPanel snapshot={snapshot} onChange={onChange} />
        </TabsContent>
        <TabsContent value="agents" className="m-0 p-4">
          <SubagentPanel snapshot={snapshot} onChange={onChange} />
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
          {snapshot.workspaceFiles.slice(0, 24).map((file) => (
            <span key={file} className="truncate font-mono text-xs text-muted-foreground">
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

function DesignPanel({
  snapshot,
  onChange,
}: {
  snapshot: DashboardSnapshot;
  onChange: () => Promise<void>;
}) {
  async function applyToken(token: DashboardSnapshot["designTokens"][number]) {
    await postJson("/api/design-tokens/apply", token);
    await onChange();
  }

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
            <Button size="sm" variant="outline" onClick={() => applyToken(token)}>
              <Sparkles className="size-4" />
              적용
            </Button>
          </div>
          <div className="mt-2 flex gap-1">
            <Badge variant="secondary">{token.category}</Badge>
            <Badge variant="outline">{token.scope}</Badge>
          </div>
        </article>
      ))}
    </div>
  );
}

function HarnessPanel({
  snapshot,
  onChange,
}: {
  snapshot: DashboardSnapshot;
  onChange: () => Promise<void>;
}) {
  async function applyProfile(profile: DashboardSnapshot["harnessProfiles"][number]) {
    await postJson("/api/harness/apply", {
      profileId: profile.id,
      name: profile.name,
    });
    await onChange();
  }

  async function inspectSkill(
    skill: DashboardSnapshot["harnessInventory"]["skills"][number]
  ) {
    await postJson("/api/runs", {
      mode: "plan",
      riskLevel: "low",
      title: `Repo skill 점검: ${skill.name}`,
      prompt: `Repo-local skill '${skill.name}' (${skill.filePath})를 점검해줘. SKILL.md frontmatter, agents/openai.yaml, references 구성을 확인하고 필요한 개선을 dashboard progress로 보고해줘. 전역 설정은 건드리지 마.`,
    });
    await onChange();
  }

  async function inspectMcp(
    server: DashboardSnapshot["harnessInventory"]["mcpServers"][number]
  ) {
    await postJson("/api/runs", {
      mode: "standard",
      riskLevel: "low",
      title: `MCP 점검: ${server.name}`,
      prompt: `Project-local MCP server '${server.name}' (${server.url}) 설정을 점검해줘. ${server.filePath}와 dashboard MCP health를 확인하고 연결 문제나 config 개선점을 보고해줘.`,
    });
    await onChange();
  }

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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium">{skill.name}</h3>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {skill.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => inspectSkill(skill)}
                >
                  <Play className="size-4" />
                  점검
                </Button>
              </div>
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
          MCP Servers
        </div>
        {snapshot.harnessInventory.mcpServers.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
            `.codex/config*.toml` 안에 MCP server 설정 없음
          </p>
        ) : (
          snapshot.harnessInventory.mcpServers.map((server) => (
            <article
              key={`${server.source}-${server.name}`}
              className="rounded-md border border-border bg-muted/10 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium">{server.name}</h3>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {server.url || "url 없음"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => inspectMcp(server)}
                >
                  <Play className="size-4" />
                  연결 점검
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge variant={server.enabled ? "secondary" : "outline"}>
                  {server.enabled ? "enabled" : "disabled"}
                </Badge>
                {server.required && <Badge variant="outline">required</Badge>}
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">{profile.name}</h3>
              <p className="text-xs text-muted-foreground">
                {profile.description}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => applyProfile(profile)}
            >
              <Play className="size-4" />
              점검
            </Button>
          </div>
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

function SubagentPanel({
  snapshot,
  onChange,
}: {
  snapshot: DashboardSnapshot;
  onChange: () => Promise<void>;
}) {
  async function applyAgent(agent: DashboardSnapshot["subagents"][number]) {
    await postJson("/api/subagents/apply", {
      subagentId: agent.id,
      name: agent.name,
      filePath: agent.filePath,
    });
    await onChange();
  }

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
            <Button size="sm" variant="outline" onClick={() => applyAgent(agent)}>
              <Bot className="size-4" />
              적용
            </Button>
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
