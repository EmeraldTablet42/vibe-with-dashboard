import { NextResponse } from "next/server";
import { z } from "zod";

import { createRun } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createRunSchema = z.object({
  prompt: z.string().min(1),
  mode: z.enum(["standard", "long", "plan"]).default("standard"),
  cardId: z.string().nullable().optional(),
  title: z.string().optional(),
  riskLevel: z.enum(["low", "normal", "high"]).default("normal"),
});

export async function POST(request: Request) {
  const input = createRunSchema.parse(await request.json());
  return NextResponse.json(createRun(input), { status: 201 });
}

