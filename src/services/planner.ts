import { AgentPlan, TriageResult } from "../types";
import { ContextSnapshot } from "./context";

export const buildAgentPlan = (
  message: string,
  triage: TriageResult,
  context: ContextSnapshot,
): AgentPlan => {
  const title = `Investigate and fix: ${message}`.slice(0, 120);

  const hypotheses = [
    "The issue may be caused by incorrect filtering, mapping, or serialization in the backend flow.",
    "Recent logic changes may have introduced a data-shaping regression for the affected page.",
    "Tests may be missing for the specific scenario described in the trigger.",
  ];

  const investigationSteps = [
    "Locate the backend endpoint or service that supplies data to the affected page.",
    "Trace how the returned data is queried, transformed, and serialized.",
    "Check recent commits around the relevant modules for regressions.",
    "Identify whether the issue is caused by business logic, mapping, stale caching, or missing guards.",
  ];

  const implementationSteps = [
    "Apply the smallest safe code change that fixes the incorrect behavior.",
    "Add or update tests covering the failing scenario described in the trigger.",
    "Avoid unrelated refactors while addressing the issue.",
  ];

  const validationSteps = context.validationCommands.length > 0
    ? context.validationCommands
    : ["Run the repo's relevant tests and linters for changed code."];

  const constraints = [
    "Stay within the relevant backend/data flow unless broader impact is required.",
    "Do not change protected or sensitive paths without review.",
    "Prefer minimal, test-backed fixes over broad refactors.",
  ];

  const handoffPrompt = [
    `Task: ${message}`,
    `Classification: ${triage.taskType} (${triage.severity}, confidence ${triage.confidence})`,
    `Relevant areas: ${context.relevantAreas.join(", ")}`,
    "Your job:",
    "1. Investigate the most likely root cause.",
    "2. Implement the smallest safe fix.",
    "3. Add or update tests.",
    "4. Summarize changed files and what was fixed.",
    `Validation to run: ${validationSteps.join(" | ")}`,
    `Constraints: ${constraints.join(" ")}`,
  ].join("\n");

  return {
    title,
    summary: "Structured execution plan generated from a natural-language engineering trigger.",
    hypotheses,
    relevantAreas: context.relevantAreas,
    investigationSteps,
    implementationSteps,
    validationSteps,
    constraints,
    handoffPrompt,
  };
};
