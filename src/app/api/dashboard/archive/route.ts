import { NextResponse } from "next/server";

import { archiveActiveBoard } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const result = archiveActiveBoard();
  return NextResponse.json({ ok: true, ...result });
}
