import { NextResponse } from "next/server";
import { z } from "zod";

import { moveCard } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const cardPatchSchema = z.object({
  status: z.enum(["backlog", "ready", "doing", "review", "done"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const [{ id }, input] = await Promise.all([
    context.params,
    request.json().then((body) => cardPatchSchema.parse(body)),
  ]);
  moveCard(id, input.status);
  return NextResponse.json({ ok: true });
}

