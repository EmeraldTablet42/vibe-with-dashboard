import { NextResponse } from "next/server";
import { z } from "zod";

import { addActivity, addAgentCheckpoint } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const activitySchema = z.object({
  phase: z.enum(["start", "plan", "implement", "verify", "result", "fail"]),
  source: z.string().min(1).default("agent"),
  status: z.enum(["active", "done", "failed"]).default("done"),
  task: z.string().default(""),
  title: z.string().min(1),
  message: z.string().min(1),
  metadata: z.unknown().optional(),
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

  if (input.checkpoint) {
    addAgentCheckpoint({
      agent: input.checkpoint.agent,
      task: input.task,
      status: input.checkpoint.status,
      summary: input.checkpoint.summary,
      payload: input.checkpoint.payload,
    });
  }

  return NextResponse.json({ ok: true, activity }, { status: 201 });
}
