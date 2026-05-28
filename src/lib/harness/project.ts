import fs from "node:fs/promises";
import path from "node:path";

type SkillFrontmatter = {
  name?: string;
  description?: string;
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
    .relative(/*turbopackIgnore: true*/ process.cwd(), filePath)
    .replaceAll("\\", "/");
}

function workspacePath(...segments: string[]) {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ...segments);
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

  const configFiles = await Promise.all(
    [
      "AGENTS.md",
      "my_project_dashboard.md",
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
    skills,
    mcpServers,
    configFiles,
  };
}
