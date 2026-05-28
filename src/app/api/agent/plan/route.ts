import { NextResponse } from "next/server";
import { z } from "zod";

import { upsertPlan } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const cardSchema = z.object({
  title: z.string().min(1),
  summary: z.string().optional(),
  translations: z
    .record(
      z.string(),
      z.object({
        title: z.string().optional(),
        summary: z.string().optional(),
        task: z.string().optional(),
        acceptanceCriteria: z.string().optional(),
      })
    )
    .optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  status: z.enum(["backlog", "ready", "doing", "review", "done"]).optional(),
  size: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  verificationCommand: z.string().optional(),
});

const planSchema = z.object({
  task: z.string().min(1),
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  translations: z
    .record(
      z.string(),
      z.object({
        title: z.string().optional(),
        summary: z.string().optional(),
        task: z.string().optional(),
      })
    )
    .optional(),
  milestone: z
    .object({
      title: z.string().min(1).optional(),
      summary: z.string().optional(),
      translations: z
        .record(
          z.string(),
          z.object({
            title: z.string().optional(),
            summary: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  source: z.string().min(1).default("agent"),
  cards: z.array(cardSchema).optional(),
});

export async function POST(request: Request) {
  const input = planSchema.parse(await request.json());
  const plan = upsertPlan(input);
  return NextResponse.json({ ok: true, plan }, { status: 201 });
}
