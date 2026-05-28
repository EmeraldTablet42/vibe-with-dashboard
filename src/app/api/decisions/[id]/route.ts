import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveDecision } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const decisionPatchSchema = z.object({
  status: z.enum(["approved", "rejected", "resolved"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const [{ id }, input] = await Promise.all([
    context.params,
    request.json().then((body) => decisionPatchSchema.parse(body)),
  ]);
  resolveDecision(id, input.status);
  return NextResponse.json({ ok: true });
}

