import http from "node:http";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as z from "zod/v4";

import {
  completeRun,
  getDashboardSnapshot,
  getSetting,
  heartbeat,
  pollNextRun,
  reportProgress,
  requestDecision,
  syncPlanUpdate,
} from "../src/lib/db/queries";
import { ensureSeedData } from "../src/lib/db/seed";

const port = Number(process.env.DASHBOARD_MCP_PORT ?? 3333);
const host = process.env.DASHBOARD_MCP_HOST ?? "127.0.0.1";

function result(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function parsePayload(payloadJson?: string) {
  if (!payloadJson) return undefined;
  try {
    return JSON.parse(payloadJson) as unknown;
  } catch {
    return { raw: payloadJson };
  }
}

function createServer() {
  const server = new McpServer(
    {
      name: "my-project-dashboard",
      version: "0.1.0",
    },
    { capabilities: { logging: {} } }
  );

  server.registerTool(
    "heartbeat",
    {
      title: "Heartbeat",
      description:
        "Report Codex loop liveness and receive adaptive heartbeat cadence.",
      inputSchema: {
        sessionId: z.string().optional(),
        label: z.string().optional(),
        currentRunId: z.string().nullable().optional(),
        notes: z.string().optional(),
      },
    },
    async (input) => result(heartbeat(input))
  );

  server.registerTool(
    "get_session_context",
    {
      title: "Get Session Context",
      description:
        "Read dashboard state needed before running work: goal, runs, decisions, settings, launch metadata.",
      inputSchema: {},
    },
    async () => {
      const snapshot = await getDashboardSnapshot();
      return result({
        generatedAt: snapshot.generatedAt,
        goals: snapshot.goals,
        openDecisions: snapshot.decisions.filter(
          (decision) => decision.status === "open"
        ),
        recentRuns: snapshot.runs.slice(0, 8),
        settings: snapshot.settings,
        launch: snapshot.launch,
      });
    }
  );

  server.registerTool(
    "poll_next_run",
    {
      title: "Poll Next Run",
      description:
        "Claim the oldest queued Run and move it to running, or learn that the loop should idle/stop.",
      inputSchema: {
        sessionId: z.string().optional(),
      },
    },
    async ({ sessionId }) => result(pollNextRun(sessionId))
  );

  server.registerTool(
    "report_progress",
    {
      title: "Report Progress",
      description:
        "Append a structured progress event for a Run or for the overall dashboard loop.",
      inputSchema: {
        runId: z.string().nullable().optional(),
        type: z.string().optional(),
        severity: z
          .enum(["debug", "info", "success", "warning", "error"])
          .optional(),
        title: z.string(),
        message: z.string(),
        payloadJson: z.string().optional(),
      },
    },
    async (input) =>
      result({
        eventId: reportProgress({
          ...input,
          payload: parsePayload(input.payloadJson),
        }),
      })
  );

  server.registerTool(
    "request_decision",
    {
      title: "Request Decision",
      description:
        "Ask the user for approval or product input through dashboard Decision Queue.",
      inputSchema: {
        runId: z.string().nullable().optional(),
        title: z.string(),
        body: z.string(),
        options: z.array(z.string()).optional(),
      },
    },
    async (input) => result(requestDecision(input))
  );

  server.registerTool(
    "complete_run",
    {
      title: "Complete Run",
      description: "Mark a Run as completed, failed, or cancelled with result text.",
      inputSchema: {
        runId: z.string(),
        status: z.enum(["completed", "failed", "cancelled"]).optional(),
        result: z.string(),
      },
    },
    async (input) => result(completeRun(input))
  );

  server.registerTool(
    "sync_plan_update",
    {
      title: "Sync Plan Update",
      description:
        "Record a structured planning update from Codex into dashboard event history.",
      inputSchema: {
        title: z.string(),
        message: z.string(),
        payloadJson: z.string().optional(),
      },
    },
    async (input) =>
      result(
        syncPlanUpdate({
          title: input.title,
          message: input.message,
          payload: parsePayload(input.payloadJson),
        })
      )
  );

  server.registerTool(
    "check_shutdown",
    {
      title: "Check Shutdown",
      description: "Return graceful shutdown flag for the active dashboard loop.",
      inputSchema: {},
    },
    async () =>
      result({
        shutdownRequested: getSetting("shutdown_requested", "false") === "true",
      })
  );

  return server;
}

async function readBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

ensureSeedData();

const httpServer = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);

  if (url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, name: "my-project-dashboard" }));
    return;
  }

  if (url.pathname !== "/mcp") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  if (request.method !== "POST") {
    response.writeHead(405, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      })
    );
    return;
  }

  const mcp = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await mcp.connect(transport);
    const body = await readBody(request);
    await transport.handleRequest(request, response, body);
    response.on("close", () => {
      transport.close();
      mcp.close();
    });
  } catch (error) {
    console.error("[mcp] request failed", error);
    if (!response.headersSent) {
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        })
      );
    }
  }
});

httpServer.listen(port, host, () => {
  console.log(`[mcp] listening http://${host}:${port}/mcp`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`[mcp] ${signal}`);
    httpServer.close(() => process.exit(0));
  });
}

