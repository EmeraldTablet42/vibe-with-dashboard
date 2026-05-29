import { NextResponse } from "next/server";
import { z } from "zod";

import { updateGoal } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const goalPatchSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  translations: z
    .record(
      z.string(),
      z.object({
        title: z.string().optional(),
        summary: z.string().optional(),
      })
    )
    .optional(),
  status: z.enum(["active", "paused", "complete"]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  position: z.number().int().nonnegative().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const [{ id }, input] = await Promise.all([
    context.params,
    request.json().then((body) => goalPatchSchema.parse(body)),
  ]);
  updateGoal(id, input);
  return NextResponse.json({ ok: true });
}
