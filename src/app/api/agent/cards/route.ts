import { NextResponse } from "next/server";
import { z } from "zod";

import { updateCardsProgress } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const cardUpdateSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  translations: z
    .record(
      z.string(),
      z.object({
        title: z.string().optional(),
        summary: z.string().optional(),
        acceptanceCriteria: z.string().optional(),
      })
    )
    .optional(),
  status: z.enum(["backlog", "ready", "doing", "review", "done"]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  owner: z.string().optional(),
  size: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  verificationCommand: z.string().optional(),
  dependsOn: z.array(z.string()).optional(),
  position: z.number().int().optional(),
});

const payloadSchema = z.object({
  updates: z.array(cardUpdateSchema).min(1),
});

export async function POST(request: Request) {
  const input = payloadSchema.parse(await request.json());
  const cardUpdates = updateCardsProgress(input.updates);
  return NextResponse.json({ ok: true, cardUpdates }, { status: 200 });
}
