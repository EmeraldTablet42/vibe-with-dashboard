import fs from "node:fs/promises";
import path from "node:path";

import { getAppRoot, getProjectRoot } from "@/lib/project-root";

type SkillFrontmatter = {
  name?: string;
  description?: string;
};

type ProjectDesignToken = {
  id: string;
  name: string;
  value: string;
  category: string;
  scope: string;
  status: string;
  updatedAt: string;
  sourcePath: string;
  sourceKind: "css-custom-property" | "token-json" | "agent-note";
};

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readIfExists(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function normalizePath(filePath: string) {
  return path
    .relative(getProjectRoot(), filePath)
    .replaceAll("\\", "/");
}

function workspacePath(...segments: string[]) {
  return path.join(getProjectRoot(), ...segments);
}

const ignoredDesignSegments = new Set([
  ".dashboard",
  ".git",
  ".next",
  ".vibe-with-dashboard",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
]);

function isIgnoredProjectPath(relativePath: string) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (
    normalized.startsWith(".agents/skills/vibe-with-dashboard/") ||
    normalized.startsWith("skills/vibe-with-dashboard/")
  ) {
    return true;
  }

  return normalized.split("/").some((part) => ignoredDesignSegments.has(part));
}

function designCategory(name: string, sourceKind: ProjectDesignToken["sourceKind"]) {
  if (sourceKind === "agent-note") return "note";
  const normalized = name.toLowerCase();
  if (normalized.includes("color") || normalized.includes("background")) return "color";
  if (normalized.includes("font") || normalized.includes("text")) return "typography";
  if (normalized.includes("space") || normalized.includes("gap") || normalized.includes("spacing")) {
    return "spacing";
  }
  if (normalized.includes("radius") || normalized.includes("shadow")) return "shape";
  return "token";
}

function makeTokenId(sourcePath: string, name: string, index: number) {
  return `project-token:${sourcePath}:${name}:${index}`;
}

async function listProjectFiles() {
  const root = getProjectRoot();
  const appRoot = path.resolve(getAppRoot());
  const files: string[] = [];
  const maxFiles = 1_500;

  async function walk(dir: string) {
    if (files.length >= maxFiles) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const resolvedFullPath = path.resolve(fullPath);
      if (
        resolvedFullPath === appRoot ||
        resolvedFullPath.startsWith(`${appRoot}${path.sep}`)
      ) {
        continue;
      }
      const relativePath = normalizePath(fullPath);
      if (isIgnoredProjectPath(relativePath)) continue;
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.isFile()) files.push(fullPath);
      if (files.length >= maxFiles) return;
    }
  }

  await walk(root);
  return files;
}

function extractCssTokens(sourcePath: string, content: string): ProjectDesignToken[] {
  const tokens: ProjectDesignToken[] = [];
  const pattern = /(--[A-Za-z0-9-_]+)\s*:\s*([^;}{]+)/g;
  for (const match of content.matchAll(pattern)) {
    const name = match[1].trim();
    const value = match[2].trim();
    tokens.push({
      id: makeTokenId(sourcePath, name, tokens.length),
      name,
      value,
      category: designCategory(name, "css-custom-property"),
      scope: sourcePath,
      status: "detected",
      updatedAt: new Date().toISOString(),
      sourcePath,
      sourceKind: "css-custom-property",
    });
  }
  return tokens;
}

function flattenJsonTokens(
  sourcePath: string,
  value: unknown,
  prefix = "",
  tokens: ProjectDesignToken[] = []
) {
  if (tokens.length >= 80) return tokens;

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    if (prefix) {
      tokens.push({
        id: makeTokenId(sourcePath, prefix, tokens.length),
        name: prefix,
        value: String(value),
        category: designCategory(prefix, "token-json"),
        scope: sourcePath,
        status: "detected",
        updatedAt: new Date().toISOString(),
        sourcePath,
        sourceKind: "token-json",
      });
    }
    return tokens;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return tokens;
  const record = value as Record<string, unknown>;
  const directValue = record.value;
  if (
    prefix &&
    (typeof directValue === "string" ||
      typeof directValue === "number" ||
      typeof directValue === "boolean")
  ) {
    tokens.push({
      id: makeTokenId(sourcePath, prefix, tokens.length),
      name: prefix,
      value: String(directValue),
      category: designCategory(prefix, "token-json"),
      scope: sourcePath,
      status: "detected",
      updatedAt: new Date().toISOString(),
      sourcePath,
      sourceKind: "token-json",
    });
    return tokens;
  }

  for (const [key, child] of Object.entries(record)) {
    flattenJsonTokens(sourcePath, child, prefix ? `${prefix}.${key}` : key, tokens);
  }
  return tokens;
}

function shouldReadTokenJson(relativePath: string) {
  const base = path.basename(relativePath).toLowerCase();
  return (
    base.endsWith(".json") &&
    (base.includes("token") || base.includes("theme") || base.includes("design"))
  );
}

function shouldReadDesignNote(relativePath: string) {
  const base = path.basename(relativePath).toLowerCase();
  return (
    base === "design_system.md" ||
    base === "design-system.md" ||
    base === "design-tokens.md" ||
    base === "tokens.md"
  );
}

function noteSummary(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(" ")
    .slice(0, 600);
}

function parseFrontmatter(markdown: string): SkillFrontmatter {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const metadata: SkillFrontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const [rawKey, ...rawValue] = line.split(":");
    const key = rawKey?.trim();
    const value = rawValue.join(":").trim().replace(/^['"]|['"]$/g, "");
    if (key === "name" || key === "description") {
      metadata[key] = value.replace(/^>\s*/, "");
    }
  }

  return metadata;
}

function parseMcpServers(toml: string, source: "local" | "example", filePath: string) {
  const servers: Array<{
    name: string;
    url: string;
    enabled: boolean;
    required: boolean;
    source: "local" | "example";
    filePath: string;
  }> = [];
  const blockPattern = /\[mcp_servers\.([^\]]+)]([\s\S]*?)(?=\r?\n\[|$)/g;

  for (const match of toml.matchAll(blockPattern)) {
    const body = match[2];
    const url = body.match(/^\s*url\s*=\s*"([^"]+)"/m)?.[1] ?? "";
    const enabled =
      body.match(/^\s*enabled\s*=\s*(true|false)/m)?.[1] !== "false";
    const required =
      body.match(/^\s*required\s*=\s*(true|false)/m)?.[1] === "true";

    servers.push({
      name: match[1],
      url,
      enabled,
      required,
      source,
      filePath,
    });
  }

  return servers;
}

export async function getProjectHarnessInventory() {
  const skillsRoot = workspacePath(".agents", "skills");
  const skillEntries = await fs
    .readdir(skillsRoot, { withFileTypes: true })
    .catch(() => []);

  const skills = await Promise.all(
    skillEntries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const skillDir = path.join(skillsRoot, entry.name);
        const skillPath = path.join(skillDir, "SKILL.md");
        const markdown = await readIfExists(skillPath);
        if (!markdown) return null;
        const frontmatter = parseFrontmatter(markdown);
        const references = await fs
          .readdir(path.join(skillDir, "references"))
          .catch(() => []);

        return {
          id: entry.name,
          name: frontmatter.name ?? entry.name,
          description:
            frontmatter.description ??
            markdown
              .split(/\r?\n/)
              .find((line) => line.trim() && !line.startsWith("---")) ??
            "",
          filePath: normalizePath(skillPath),
          hasOpenAiYaml: await exists(path.join(skillDir, "agents", "openai.yaml")),
          references: references.length,
        };
      })
  );
  const presentSkills = skills.filter(
    (skill): skill is NonNullable<(typeof skills)[number]> => skill !== null
  );

  const configFiles = await Promise.all(
    [
      "AGENTS.md",
      "vibe_with_dashboard.md",
      ".codex/config.example.toml",
      ".codex/config.toml",
    ].map(async (relativePath) => ({
      path: relativePath,
      exists: await exists(workspacePath(relativePath)),
    }))
  );

  const mcpSources = await Promise.all(
    [
      { source: "example" as const, path: ".codex/config.example.toml" },
      { source: "local" as const, path: ".codex/config.toml" },
    ].map(async (source) => ({
      ...source,
      toml: await readIfExists(workspacePath(source.path)),
    }))
  );

  const mcpServers = mcpSources.flatMap((source) =>
    parseMcpServers(source.toml, source.source, source.path)
  );

  return {
    skills: presentSkills,
    mcpServers,
    configFiles,
  };
}

export async function getProjectDesignSystemInventory() {
  const files = await listProjectFiles();
  const tokens: ProjectDesignToken[] = [];
  const tokenFiles = new Map<string, { path: string; kind: string; tokenCount: number }>();
  const notes: Array<{ path: string; summary: string }> = [];

  for (const filePath of files) {
    const relativePath = normalizePath(filePath);
    const extension = path.extname(filePath).toLowerCase();
    if ([".css", ".scss", ".sass", ".less", ".pcss"].includes(extension)) {
      const extracted = extractCssTokens(relativePath, await readIfExists(filePath));
      if (extracted.length > 0) {
        tokens.push(...extracted);
        tokenFiles.set(relativePath, {
          path: relativePath,
          kind: "css",
          tokenCount: extracted.length,
        });
      }
      continue;
    }

    if (shouldReadTokenJson(relativePath)) {
      try {
        const extracted = flattenJsonTokens(
          relativePath,
          JSON.parse(await readIfExists(filePath))
        );
        if (extracted.length > 0) {
          tokens.push(...extracted);
          tokenFiles.set(relativePath, {
            path: relativePath,
            kind: "json",
            tokenCount: extracted.length,
          });
        }
      } catch {
        // Ignore malformed token candidates; they still appear as project files elsewhere.
      }
      continue;
    }

    if (shouldReadDesignNote(relativePath)) {
      const summary = noteSummary(await readIfExists(filePath));
      if (summary) notes.push({ path: relativePath, summary });
    }
  }

  return {
    tokens: tokens.slice(0, 120),
    files: [...tokenFiles.values()],
    notes,
  };
}
