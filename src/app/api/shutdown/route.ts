import { NextResponse } from "next/server";

import { getSetting, requestShutdown } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    shutdownRequested: getSetting("shutdown_requested", "false") === "true",
  });
}

export async function POST() {
  requestShutdown("dashboard");
  return NextResponse.json({ ok: true, shutdownRequested: true });
}

