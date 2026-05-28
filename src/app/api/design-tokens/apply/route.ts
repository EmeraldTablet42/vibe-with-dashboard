import { NextResponse } from "next/server";
import { z } from "zod";

import { createRun } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  tokenId: z.string(),
  name: z.string(),
  value: z.string(),
});

export async function POST(request: Request) {
  const input = schema.parse(await request.json());
  const run = createRun({
    mode: "standard",
    riskLevel: "normal",
    title: `디자인 토큰 적용: ${input.name}`,
    prompt: `Design System token '${input.name}' 값을 '${input.value}'로 코드에 반영해줘. 변경 전 관련 파일을 확인하고, 적용 후 lint/typecheck 가능한지 보고해줘. tokenId=${input.tokenId}`,
  });

  return NextResponse.json(run, { status: 201 });
}

