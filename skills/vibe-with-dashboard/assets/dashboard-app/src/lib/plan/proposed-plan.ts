import type { CardPriority, CardStatus } from "@/lib/types";

type ProposedPlanCard = {
  title: string;
  summary: string;
  priority: CardPriority;
  status: CardStatus;
};

type ProposedPlanMilestone = {
  title: string;
  summary: string;
  priority: CardPriority;
  cards: ProposedPlanCard[];
};

export type ProposedPlanDashboardPayload = {
  task: string;
  title: string;
  summary: string;
  replace: true;
  source: "proposed_plan";
  milestones: ProposedPlanMilestone[];
};

type Section = {
  title: string;
  body: string[];
  bullets: string[];
};

function stripMarkdown(value: string) {
  return value
    .replace(/^#+\s*/, "")
    .replace(/^\*\*(.*)\*\*$/, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function extractProposedPlan(markdown: string) {
  const match = markdown.match(/<proposed_plan>([\s\S]*?)<\/proposed_plan>/i);
  return (match?.[1] ?? markdown).trim();
}

function cardTitleFromBullet(bullet: string) {
  const cleaned = stripMarkdown(bullet);
  const [beforeColon] = cleaned.split(":");
  const candidate =
    beforeColon && beforeColon.length >= 6 && beforeColon.length <= 80
      ? beforeColon
      : cleaned;
  return candidate.length > 84 ? `${candidate.slice(0, 81).trim()}...` : candidate;
}

function sectionPriority(title: string): CardPriority {
  const normalized = title.toLowerCase();
  if (normalized.includes("assumption")) return "low";
  if (normalized.includes("test") || normalized.includes("verify")) return "medium";
  return "high";
}

function sectionStatus(title: string): CardStatus {
  return title.toLowerCase().includes("assumption") ? "backlog" : "ready";
}

export function convertProposedPlanToDashboardPayload(
  markdown: string
): ProposedPlanDashboardPayload {
  const plan = extractProposedPlan(markdown);
  const lines = plan.split(/\r?\n/);
  const titleLine =
    lines.find((line) => /^#\s+/.test(line.trim())) ??
    lines.find((line) => line.trim()) ??
    "Imported plan";
  const title = stripMarkdown(titleLine) || "Imported plan";
  const sections: Section[] = [];
  let current: Section | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^#\s+/.test(line)) continue;

    const heading = line.match(/^#{2,6}\s+(.+)$/);
    if (heading) {
      current = { title: stripMarkdown(heading[1]), body: [], bullets: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = { title: "Plan", body: [], bullets: [] };
      sections.push(current);
    }

    const bullet = line.match(/^(?:[-*+]|\d+\.)\s+(.+)$/);
    if (bullet) {
      current.bullets.push(stripMarkdown(bullet[1]));
    } else {
      current.body.push(stripMarkdown(line));
    }
  }

  const milestones = sections
    .filter((section) => section.title || section.body.length || section.bullets.length)
    .map((section) => {
      const priority = sectionPriority(section.title);
      const cards = section.bullets.map((bullet) => ({
        title: cardTitleFromBullet(bullet),
        summary: bullet,
        priority,
        status: sectionStatus(section.title),
      }));

      return {
        title: section.title || "Plan",
        summary: section.body.join(" ").trim() || section.bullets.join(" "),
        priority,
        cards,
      };
    });

  const summary = sections.flatMap((section) => section.body).join(" ").trim();

  return {
    task: title,
    title,
    summary,
    replace: true,
    source: "proposed_plan",
    milestones,
  };
}
