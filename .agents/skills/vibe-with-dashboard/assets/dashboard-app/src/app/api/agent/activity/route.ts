import { NextResponse } from "next/server";
import { z } from "zod";

import {
  addActivity,
  addAgentCheckpoint,
  updateCardsProgress,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const activitySchema = z.object({
  phase: z.enum(["start", "plan", "implement", "verify", "result", "fail"]),
  source: z.string().min(1).default("agent"),
  status: z.enum(["active", "done", "failed"]).default("done"),
  task: z.string().default(""),
  title: z.string().min(1),
  message: z.string().min(1),
  translations: z
    .record(
      z.string(),
      z.object({
        title: z.string().optional(),
        message: z.string().optional(),
      })
    )
    .optional(),
  metadata: z.unknown().optional(),
  cards: z
    .array(
      z.object({
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
      })
    )
    .optional(),
  checkpoint: z
    .object({
      agent: z.string().min(1).default("agent"),
      summary: z.string().min(1),
      status: z.enum(["active", "idle", "done", "failed"]).default("active"),
      payload: z.unknown().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const input = activitySchema.parse(await request.json());
  const activity = addActivity(input);
  const cardUpdates = input.cards ? updateCardsProgress(input.cards) : [];

  if (input.checkpoint) {
    addAgentCheckpoint({
      agent: input.checkpoint.agent,
      task: input.task,
      status: input.checkpoint.status,
      summary: input.checkpoint.summary,
      payload: input.checkpoint.payload,
    });
  }

  return NextResponse.json({ ok: true, activity, cardUpdates }, { status: 201 });
}
