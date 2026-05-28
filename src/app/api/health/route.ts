import { NextResponse } from "next/server";

import { getAppRoot, getProjectRoot } from "@/lib/project-root";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    appId: "vibe-with-dashboard",
    service: "vibe-with-dashboard",
    projectRoot: getProjectRoot(),
    appRoot: getAppRoot(),
    port: Number(process.env.DASHBOARD_PORT ?? process.env.PORT ?? 3000),
    generatedAt: new Date().toISOString(),
  });
}
