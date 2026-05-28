import { NextResponse } from "next/server";

import { archiveActiveBoard, clearArchives } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const result = archiveActiveBoard();
  return NextResponse.json({ ok: true, ...result });
}

export async function DELETE() {
  const result = clearArchives();
  return NextResponse.json({ ok: true, ...result });
}
