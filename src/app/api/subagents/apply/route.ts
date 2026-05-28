import { NextResponse } from "next/server";
import { z } from "zod";

import { createRun } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  subagentId: z.string(),
  name: z.string(),
  filePath: z.string(),
});

export async function POST(request: Request) {
  const input = schema.parse(await request.json());
  const run = createRun({
    mode: "standard",
    riskLevel: "normal",
    title: `Subagent 정의 적용: ${input.name}`,
    prompt: `Subagent '${input.name}' 정의를 project-local Codex agent 파일 '${input.filePath}'와 맞춰줘. 전역 설정은 건드리지 말고 변경 후 요약해줘. subagentId=${input.subagentId}`,
  });

  return NextResponse.json(run, { status: 201 });
}

