import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    appId: "codex-dashboard",
    service: "my_project_dashboard",
    projectRoot: process.cwd(),
    port: Number(process.env.DASHBOARD_PORT ?? process.env.PORT ?? 3000),
    generatedAt: new Date().toISOString(),
  });
}
