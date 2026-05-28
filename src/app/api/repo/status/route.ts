import { NextResponse } from "next/server";

import { getGithubStatus, getRepoStatus, getWorkspaceFiles } from "@/lib/repo/git";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [repoStatus, githubStatus, workspaceFiles] = await Promise.all([
    getRepoStatus(),
    getGithubStatus(),
    getWorkspaceFiles(),
  ]);

  return NextResponse.json({ repoStatus, githubStatus, workspaceFiles });
}

