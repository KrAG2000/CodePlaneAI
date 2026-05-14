import { config } from "../config";
import { executionStore } from "../store/file-store";
import { AgentResult, ExecutionRecord } from "../types";
import { createExecutionId, nowIso } from "../utils";
import { buildContext } from "./context";
import { finalizeGitFlow, runValidation } from "./git-service";
import { buildAgentPlan } from "./planner";
import { evaluatePolicy } from "./policy";
import { triageMessage } from "./triage";

export const createExecution = (message: string): ExecutionRecord => {
  const triage = triageMessage(message);
  const policy = evaluatePolicy(config.protectedPaths);
  const context = buildContext(message, triage);
  const plan = buildAgentPlan(message, triage, context);
  const now = nowIso();

  const record: ExecutionRecord = {
    id: createExecutionId(),
    message,
    createdAt: now,
    updatedAt: now,
    status: "awaiting_agent",
    triage,
    policy,
    plan,
  };

  return executionStore.save(record);
};

export const listExecutions = (): ExecutionRecord[] => executionStore.list();

export const getExecution = (id: string): ExecutionRecord | undefined =>
  executionStore.get(id);

export const applyAgentResult = async (
  id: string,
  agentResult: AgentResult,
): Promise<ExecutionRecord> => {
  const existing = executionStore.get(id);
  if (!existing) {
    throw new Error(`Execution not found: ${id}`);
  }

  const validation = runValidation();
  const next: ExecutionRecord = {
    ...existing,
    updatedAt: nowIso(),
    status: validation.success ? "validated" : "failed",
    agentResult,
    validation,
  };

  if (config.autoCommitOnAgentResult && validation.success && existing.policy.allowedToFinalize) {
    next.gitOutcome = await finalizeGitFlow(
      existing.id,
      existing.message,
      agentResult.changedFiles,
    );
    next.status = next.gitOutcome.skipped ? "blocked" : "pr_created";
  }

  return executionStore.save(next);
};
