const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const projectRoot = path.resolve(
  process.env.VIBE_DASHBOARD_PROJECT_ROOT || process.cwd()
);
const statePath = path.join(projectRoot, ".dashboard", "state.json");

function readStateUrl() {
  if (process.env.DASHBOARD_URL) return process.env.DASHBOARD_URL;

  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    if (state?.url) return state.url;
  } catch {
    // fall through to default
  }

  return "http://127.0.0.1:3000";
}

function parseArgs(argv) {
  const input = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      input[key] = "true";
    } else {
      input[key] = next;
      index += 1;
    }
  }

  return input;
}

function postJson(url, payload) {
  const body = JSON.stringify(payload);
  const target = new URL(url);

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(responseBody || `HTTP ${response.statusCode}`));
            return;
          }
          resolve(responseBody);
        });
      }
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const phase = args.phase || "implement";
  const message = args.message || args.title || "Activity recorded";
  const title = args.title || phase;
  const task = args.task || "";
  const status = args.status || (phase === "fail" ? "failed" : "done");
  const source = args.source || "agent";
  const metadata = args.metadata ? JSON.parse(args.metadata) : {};
  const baseUrl = readStateUrl();

  await postJson(`${baseUrl}/api/agent/activity`, {
    phase,
    source,
    status,
    task,
    title,
    message,
    metadata,
    checkpoint: args.checkpoint
      ? {
          agent: source,
          status: status === "failed" ? "failed" : "active",
          summary: args.checkpoint,
          payload: metadata,
        }
      : undefined,
  });

  process.stdout.write(`[dashboard-activity] ${phase}: ${message}\n`);
}

main().catch((error) => {
  console.error(`[dashboard-activity] ${error.message}`);
  process.exit(1);
});
