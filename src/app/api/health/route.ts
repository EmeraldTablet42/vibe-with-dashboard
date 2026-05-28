import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "my_project_dashboard",
    generatedAt: new Date().toISOString(),
  });
}
