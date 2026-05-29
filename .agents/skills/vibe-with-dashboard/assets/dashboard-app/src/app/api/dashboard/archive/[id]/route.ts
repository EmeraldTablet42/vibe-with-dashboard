import { NextResponse } from "next/server";

import { deleteArchive } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const result = deleteArchive(id);
  return NextResponse.json(
    { ok: result.deleted, result },
    { status: result.deleted ? 200 : 404 }
  );
}
