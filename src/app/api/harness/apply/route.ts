import { NextResponse } from "next/server";
import { z } from "zod";

import { createRun } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  profileId: z.string(),
  name: z.string(),
});

export async function POST(request: Request) {
  const input = schema.parse(await request.json());
  const run = createRun({
    mode: "plan",
    riskLevel: "normal",
    title: `Harness profile 적용: ${input.name}`,
    prompt: `Project-local harness profile '${input.name}'를 확인하고 .codex/config.example.toml, AGENTS.md, .agents/skills/project-dashboard-agent 구성이 일치하는지 점검/수정 계획을 세워줘. profileId=${input.profileId}`,
  });

  return NextResponse.json(run, { status: 201 });
}

