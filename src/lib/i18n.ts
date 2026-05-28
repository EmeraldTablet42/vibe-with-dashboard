export const supportedLocales = ["en", "ko"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export function resolveLocale(languages: readonly string[] = []): SupportedLocale {
  for (const language of languages) {
    const normalized = language.toLowerCase();
    const direct = supportedLocales.find((locale) => locale === normalized);
    if (direct) return direct;

    const base = normalized.split("-")[0];
    const matched = supportedLocales.find((locale) => locale === base);
    if (matched) return matched;
  }

  return "en";
}

export const dashboardMessages = {
  en: {
    active: "Active",
    archive: "Archive",
    archived: "archived",
    archiveReady: "ready to archive",
    activity: "Activity",
    activities: "Activities",
    agents: "Agents",
    auth: "Auth",
    branch: "Branch",
    cards: "Cards",
    changed: "Changed",
    closePlan: "Close plan",
    current: "Current",
    design: "Design",
    disabled: "disabled",
    done: "Done",
    enabled: "enabled",
    empty: "Empty",
    focus: "Focus",
    github: "GitHub",
    high: "High",
    inspector: "Inspector",
    kanban: "Kanban",
    launch: "Launch",
    linkedMissing: "not linked",
    low: "Low",
    medium: "Medium",
    moveCard: "Move card",
    noActivePlan: "No active plan",
    noArchivedBoards: "No archived boards",
    noActivity: "No activity yet.",
    noCards: "No cards",
    openPlan: "Open plan",
    plan: "Plan",
    repo: "Repo",
    refresh: "Refresh",
    references: "refs",
    resizePlan: "Resize plan",
    skills: "Skills",
    theme: "Toggle theme",
    waiting: "Waiting",
    workflow: "Workflow",
    status: {
      backlog: "Backlog",
      ready: "Ready",
      doing: "Doing",
      review: "Review",
      done: "Done",
    },
    statusHint: {
      backlog: "Queued",
      ready: "Ready",
      doing: "In progress",
      review: "Review",
      done: "Complete",
    },
    phase: {
      start: "Start",
      plan: "Plan",
      implement: "Build",
      verify: "Verify",
      result: "Result",
      fail: "Fail",
    },
  },
  ko: {
    active: "진행",
    archive: "아카이브",
    archived: "보관됨",
    archiveReady: "보관 가능",
    activity: "활동",
    activities: "활동",
    agents: "에이전트",
    auth: "인증",
    branch: "브랜치",
    cards: "카드",
    changed: "변경",
    closePlan: "계획 접기",
    current: "현재",
    design: "디자인",
    disabled: "꺼짐",
    done: "완료",
    enabled: "켜짐",
    empty: "비어 있음",
    focus: "포커스",
    github: "GitHub",
    high: "높음",
    inspector: "인스펙터",
    kanban: "칸반",
    launch: "실행",
    linkedMissing: "연결 없음",
    low: "낮음",
    medium: "보통",
    moveCard: "카드 이동",
    noActivePlan: "활성 계획 없음",
    noArchivedBoards: "보관된 보드 없음",
    noActivity: "활동 없음",
    noCards: "카드 없음",
    openPlan: "계획 열기",
    plan: "계획",
    repo: "Repo",
    refresh: "새로고침",
    references: "참조",
    resizePlan: "계획 폭 조절",
    skills: "스킬",
    theme: "테마 전환",
    waiting: "대기 중",
    workflow: "흐름",
    status: {
      backlog: "대기",
      ready: "준비",
      doing: "진행",
      review: "검토",
      done: "완료",
    },
    statusHint: {
      backlog: "대기",
      ready: "준비",
      doing: "진행 중",
      review: "검토",
      done: "완료",
    },
    phase: {
      start: "시작",
      plan: "계획",
      implement: "구현",
      verify: "검증",
      result: "결과",
      fail: "실패",
    },
  },
} as const;

export type DashboardMessages = (typeof dashboardMessages)[SupportedLocale];
