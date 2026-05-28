import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { getProjectRoot } from "@/lib/project-root";

const execFileAsync = promisify(execFile);

async function run(command: string, args: string[]) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: getProjectRoot(),
      timeout: 10_000,
      windowsHide: true,
    });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      stdout: err.stdout?.trim() ?? "",
      stderr: err.stderr?.trim() ?? err.message ?? "command failed",
    };
  }
}

export async function getRepoStatus() {
  const [status, branch, diffStat, remote] = await Promise.all([
    run("git", ["status", "--porcelain=v1", "-b"]),
    run("git", ["branch", "--show-current"]),
    run("git", ["diff", "--stat"]),
    run("git", ["remote", "-v"]),
  ]);

  const files = status.stdout
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("##"))
    .map((line) => ({
      code: line.slice(0, 2).trim() || "??",
      path: line.slice(3),
    }));

  return {
    isGitRepo: status.ok,
    branch: branch.stdout || "unknown",
    statusText: status.stdout || status.stderr,
    changedFiles: files,
    diffStat: diffStat.stdout,
    remotes: remote.stdout,
  };
}

export async function getGithubStatus() {
  const [auth, repo] = await Promise.all([
    run("gh", ["auth", "status"]),
    run("gh", ["repo", "view", "--json", "nameWithOwner,url"]),
  ]);

  let repoInfo: { nameWithOwner?: string; url?: string } = {};
  if (repo.ok && repo.stdout) {
    try {
      repoInfo = JSON.parse(repo.stdout) as typeof repoInfo;
    } catch {
      repoInfo = {};
    }
  }

  return {
    ghInstalled: auth.ok || auth.stderr.includes("Logged in"),
    authenticated: auth.ok,
    authText: auth.stdout || auth.stderr,
    repo: repoInfo,
    repoAvailable: repo.ok,
  };
}

export async function getWorkspaceFiles(limit = 80) {
  const ignored = new Set(["node_modules", ".git", ".next", ".dashboard"]);
  const found: string[] = [];

  async function walk(dir: string) {
    if (found.length >= limit) return;
    const entries = await fs.readdir(
      path.join(getProjectRoot(), dir),
      { withFileTypes: true }
    );

    for (const entry of entries) {
      if (found.length >= limit || ignored.has(entry.name)) continue;
      const relative = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(relative);
      } else {
        found.push(relative.replaceAll("\\", "/"));
      }
    }
  }

  await walk(".");
  return found;
}
