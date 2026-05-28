import { NextResponse } from "next/server";
import { z } from "zod";

import { updateMilestone } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const milestonePatchSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  status: z.enum(["planned", "active", "complete"]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  position: z.number().int().nonnegative().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const [{ id }, input] = await Promise.all([
    context.params,
    request.json().then((body) => milestonePatchSchema.parse(body)),
  ]);
  updateMilestone(id, input);
  return NextResponse.json({ ok: true });
}
