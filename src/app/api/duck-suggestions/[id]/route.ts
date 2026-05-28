import { NextResponse } from "next/server";

import { markDuckSuggestionRead } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const result = markDuckSuggestionRead(id);
  return NextResponse.json({ ok: true, result });
}
