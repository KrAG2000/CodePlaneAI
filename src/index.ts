import Fastify from "fastify";
import formBody from "@fastify/formbody";
import rawBody from "fastify-raw-body";
import { z } from "zod";
import { config } from "./config";
import {
  applyAgentResult,
  createExecution,
  getExecution,
  getExecutionHandoff,
  listExecutions,
} from "./services/execution-service";
import { verifySlackSignature } from "./services/slack-signature";

const server = Fastify({
  logger: {
    level: config.logLevel,
  },
});

server.register(formBody);
server.register(rawBody, {
  field: "rawBody",
  global: false,
  encoding: "utf8",
  runFirst: true,
});

server.addHook("onRequest", async (request, reply) => {
  if (request.url === "/health" || request.url.startsWith("/slack/")) {
    return;
  }

  const token = request.headers["x-api-token"];
  if (token !== config.apiTriggerToken) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Missing or invalid x-api-token header.",
    });
  }
});

server.get("/health", async () => ({
  ok: true,
  service: "codeplaneai-mvp",
}));

server.get("/api/executions", async () => ({
  items: listExecutions(),
}));

server.get("/api/executions/:id", async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const execution = getExecution(params.id);

  if (!execution) {
    reply.code(404).send({ error: "Not Found" });
    return;
  }

  return execution;
});

server.post("/api/triggers/text", async (request) => {
  const body = z
    .object({
      message: z.string().min(10),
    })
    .parse(request.body);

  const execution = await createExecution(body.message, "api");

  return {
    executionId: execution.id,
    status: execution.status,
    triage: execution.triage,
    policy: execution.policy,
    plan: execution.plan,
    handoffPath: execution.handoffPath,
    nextStep:
      "Open the handoff file in VS Code/Codex. After the code change is made in the configured repo, call POST /api/executions/:id/agent-result.",
  };
});

server.post("/api/triggers/slack", async (request) => {
  const body = z
    .object({
      text: z.string().min(10),
      user: z.string().optional(),
      channel: z.string().optional(),
    })
    .parse(request.body);

  const execution = await createExecution(body.text, "slack");

  return {
    executionId: execution.id,
    status: execution.status,
    handoffPath: execution.handoffPath,
    plan: execution.plan,
  };
});

server.post(
  "/slack/command",
  {
    config: {
      rawBody: true,
    },
  },
  async (request, reply) => {
    if (!verifySlackSignature(request)) {
      reply.code(401).send("Invalid Slack signature.");
      return;
    }

  const body = z
    .object({
      text: z.string().min(10),
      token: z.string().optional(),
      user_name: z.string().optional(),
      channel_name: z.string().optional(),
    })
    .parse(request.body);

  if (
    config.slackVerificationToken &&
    body.token !== config.slackVerificationToken
  ) {
    reply.code(401).send("Invalid Slack verification token.");
    return;
  }

  const execution = await createExecution(body.text, "slack");

  return {
    response_type: "in_channel",
    text: [
      `CodePlaneAI accepted execution ${execution.id}.`,
      `Triage: ${execution.triage.taskType} / ${execution.triage.severity}.`,
      `Codex handoff: ${execution.handoffPath}.`,
    ].join("\n"),
  };
  },
);

server.post(
  "/slack/events",
  {
    config: {
      rawBody: true,
    },
  },
  async (request, reply) => {
    if (!verifySlackSignature(request)) {
      reply.code(401).send("Invalid Slack signature.");
      return;
    }

  const body = z
    .object({
      type: z.string(),
      challenge: z.string().optional(),
      token: z.string().optional(),
      event: z
        .object({
          type: z.string(),
          text: z.string().optional(),
          subtype: z.string().optional(),
          bot_id: z.string().optional(),
        })
        .optional(),
    })
    .parse(request.body);

  if (
    config.slackVerificationToken &&
    body.token !== config.slackVerificationToken
  ) {
    reply.code(401).send("Invalid Slack verification token.");
    return;
  }

  if (body.type === "url_verification") {
    return { challenge: body.challenge };
  }

  if (
    body.type !== "event_callback" ||
    body.event?.type !== "message" ||
    !body.event.text ||
    body.event.subtype ||
    body.event.bot_id
  ) {
    return { ok: true, ignored: true };
  }

  const execution = await createExecution(body.event.text, "slack");

  return {
    ok: true,
    executionId: execution.id,
    handoffPath: execution.handoffPath,
  };
  },
);

server.get("/api/executions/:id/handoff", async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params);

  try {
    reply.type("text/markdown").send(getExecutionHandoff(params.id));
  } catch (error) {
    reply.code(404).send({
      error: "Not Found",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

server.post("/api/executions/:id/agent-result", async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const body = z
    .object({
      summary: z.string().min(5),
      changedFiles: z.array(z.string().min(1)).min(1),
      notes: z.array(z.string()).optional(),
    })
    .parse(request.body);

  try {
    const execution = await applyAgentResult(params.id, body);
    return execution;
  } catch (error) {
    reply.code(400).send({
      error: "Bad Request",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

const start = async (): Promise<void> => {
  await server.listen({
    host: "0.0.0.0",
    port: config.port,
  });
};

start().catch((error) => {
  server.log.error(error);
  process.exit(1);
});
