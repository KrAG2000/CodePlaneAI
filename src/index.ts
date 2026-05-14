import Fastify from "fastify";
import { z } from "zod";
import { config } from "./config";
import {
  applyAgentResult,
  createExecution,
  getExecution,
  listExecutions,
} from "./services/execution-service";

const server = Fastify({
  logger: {
    level: config.logLevel,
  },
});

server.addHook("onRequest", async (request, reply) => {
  if (request.url === "/health") {
    return;
  }

  const token = request.headers["x-api-token"];
  if (token !== config.apiTriggerToken) {
    reply.code(401).send({
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

  const execution = createExecution(body.message);

  return {
    executionId: execution.id,
    status: execution.status,
    triage: execution.triage,
    policy: execution.policy,
    plan: execution.plan,
    nextStep:
      "Pass plan.handoffPrompt to your coding agent. After the code change is made in the configured repo, call POST /api/executions/:id/agent-result.",
  };
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
