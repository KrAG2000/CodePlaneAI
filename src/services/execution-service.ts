import { config } from "../config";
import { executionStore } from "../store/file-store";
import { AgentResult, ExecutionRecord } from "../types";
import { createExecutionId, nowIso } from "../utils";
import { buildContext } from "./context";
import { startCodexRun } from "./codex-runner";
import { finalizeGitFlow, runValidation } from "./git-service";
import { readCodexHandoff, writeCodexHandoff } from "./handoff-service";
import { buildAgentPlan } from "./planner";
import { evaluatePolicy } from "./policy";
import { notifyExecutionCreated, notifyExecutionFinished } from "./slack-service";
import { triageMessage } from "./triage";

const markExecutionFailed = async (
  executionId: string,
  reason: string,
  agentRunPatch?: Partial<ExecutionRecord["agentRun"]>,
): Promise<void> => {
  const existing = executionStore.get(executionId);
  if (!existing) {
    return;
  }

  const saved = executionStore.save({
    ...existing,
    updatedAt: nowIso(),
    status: "failed",
    agentRun: existing.agentRun
      ? {
          ...existing.agentRun,
          ...agentRunPatch,
        }
      : existing.agentRun,
    gitOutcome: {
      branchName: existing.agentRun?.branchName ?? "",
      skipped: true,
      reasons: [reason],
    },
  });
  await notifyExecutionFinished(saved);
};

export const createExecution = async (
  message: string,
  source: ExecutionRecord["source"] = "api",
): Promise<ExecutionRecord> => {
  const triage = await triageMessage(message);
  const policy = evaluatePolicy(config.protectedPaths);
  const context = buildContext(message, triage);
  const plan = buildAgentPlan(message, triage, context);
  const now = nowIso();

  const record: ExecutionRecord = {
    id: createExecutionId(),
    message,
    source,
    createdAt: now,
    updatedAt: now,
    status: "awaiting_agent",
    triage,
    policy,
    plan,
  };

  record.handoffPath = writeCodexHandoff(record);
  const withAgentRun = startCodexRun(record, {
    onComplete: async (executionId, agentResult) => {
      await applyAgentResult(executionId, agentResult);
    },
    onFailure: async (executionId, reason, agentRunPatch) => {
      await markExecutionFailed(executionId, reason, agentRunPatch);
    },
  });
  const saved = executionStore.save(withAgentRun);
  await notifyExecutionCreated(saved);
  return saved;
};

export const listExecutions = (): ExecutionRecord[] => executionStore.list();

export const getExecution = (id: string): ExecutionRecord | undefined =>
  executionStore.get(id);

export const getExecutionHandoff = (id: string): string => {
  const execution = executionStore.get(id);
  if (!execution?.handoffPath) {
    throw new Error(`Handoff not found for execution: ${id}`);
  }

  return readCodexHandoff(execution.handoffPath);
};

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
      existing.agentRun?.branchName,
    );
    next.status = next.gitOutcome.skipped ? "blocked" : "pr_created";
  }

  const saved = executionStore.save(next);
  await notifyExecutionFinished(saved);
  return saved;
};
