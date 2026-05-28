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

export function resolveContentLocale(languages: readonly string[] = []): string {
  for (const language of languages) {
    const normalized = language.toLowerCase().trim();
    if (!normalized) continue;
    return normalized.split("-")[0] || "en";
  }

  return "en";
}

export const dashboardMessages = {
  en: {
    active: "Active",
    archive: "Archive",
    archived: "archived",
    archiveReady: "ready to archive",
    archiveClearDescription:
      "This permanently deletes every archived board for this project.",
    archiveDeleteDescription:
      "This permanently deletes this archived board. The active board is not affected.",
    activity: "Activity",
    activities: "Activities",
    agents: "Agents",
    auth: "Auth",
    branch: "Branch",
    cancel: "Cancel",
    cards: "Cards",
    changed: "Changed",
    clear: "Clear",
    clearArchives: "Clear all archives",
    closePlan: "Close plan",
    confirmClearArchives: "Clear all archives?",
    confirmDeleteArchive: "Delete archive?",
    contentLanguage: "Content language",
    current: "Current",
    overallProgress: "Progress",
    delete: "Delete",
    deleteArchive: "Delete archive",
    design: "Design",
    disabled: "disabled",
    done: "Done",
    duck: "Rubber Duck",
    duckCopied: "Copied",
    duckCopyPrompt: "Copy prompt",
    duckIdle: "No suggestions",
    duckMinimize: "Minimize duck",
    duckOpen: "Open duck suggestions",
    duckPrompt: "Prompt for your agent",
    duckSuggestions: "Suggestions",
    enabled: "enabled",
    empty: "Empty",
    englishLanguage: "English",
    focus: "Focus",
    github: "GitHub",
    goal: "Goal",
    high: "High",
    inspector: "Inspector",
    kanban: "Kanban",
    launch: "Launch",
    linkedMissing: "not linked",
    low: "Low",
    medium: "Medium",
    milestone: "Milestone",
    moveCard: "Move card",
    nativeLanguage: "Native",
    noActivePlan: "No active plan",
    noArchivedBoards: "No archived boards",
    noActivity: "No activity yet.",
    noCards: "No cards",
    openPlan: "Open plan",
    plan: "Plan",
    progressOfCards: "cards done",
    repo: "Repo",
    refresh: "Refresh",
    references: "refs",
    resizePlan: "Resize plan",
    skills: "Skills",
    theme: "Toggle theme",
    waiting: "Waiting",
    workflow: "Workflow",
    goalStatus: {
      active: "Active",
      paused: "Paused",
      complete: "Complete",
    },
    milestoneStatus: {
      planned: "Planned",
      active: "Active",
      complete: "Complete",
    },
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
    archiveClearDescription:
      "이 프로젝트의 모든 보관된 보드를 완전히 삭제합니다.",
    archiveDeleteDescription:
      "이 보관된 보드를 완전히 삭제합니다. 현재 보드는 유지됩니다.",
    activity: "활동",
    activities: "활동",
    agents: "에이전트",
    auth: "인증",
    branch: "브랜치",
    cancel: "취소",
    cards: "카드",
    changed: "변경",
    clear: "비우기",
    clearArchives: "전체 아카이브 비우기",
    closePlan: "계획 접기",
    confirmClearArchives: "전체 아카이브를 비울까요?",
    confirmDeleteArchive: "아카이브를 삭제할까요?",
    contentLanguage: "항목 언어",
    current: "현재",
    overallProgress: "진행률",
    delete: "삭제",
    deleteArchive: "아카이브 삭제",
    design: "디자인",
    disabled: "꺼짐",
    done: "완료",
    duck: "러버덕",
    duckCopied: "복사됨",
    duckCopyPrompt: "프롬프트 복사",
    duckIdle: "제안 없음",
    duckMinimize: "러버덕 최소화",
    duckOpen: "러버덕 제안 열기",
    duckPrompt: "에이전트용 프롬프트",
    duckSuggestions: "제안",
    enabled: "켜짐",
    empty: "비어 있음",
    englishLanguage: "English",
    focus: "포커스",
    github: "GitHub",
    goal: "목표",
    high: "높음",
    inspector: "인스펙터",
    kanban: "칸반",
    launch: "실행",
    linkedMissing: "연결 없음",
    low: "낮음",
    medium: "보통",
    milestone: "마일스톤",
    moveCard: "카드 이동",
    nativeLanguage: "자국어",
    noActivePlan: "활성 계획 없음",
    noArchivedBoards: "보관된 보드 없음",
    noActivity: "활동 없음",
    noCards: "카드 없음",
    openPlan: "계획 열기",
    plan: "계획",
    progressOfCards: "카드 완료",
    repo: "Repo",
    refresh: "새로고침",
    references: "참조",
    resizePlan: "계획 폭 조절",
    skills: "스킬",
    theme: "테마 전환",
    waiting: "대기 중",
    workflow: "흐름",
    goalStatus: {
      active: "진행",
      paused: "중지",
      complete: "완료",
    },
    milestoneStatus: {
      planned: "계획됨",
      active: "진행",
      complete: "완료",
    },
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
