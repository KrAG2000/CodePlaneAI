import { TriageResult } from "../types";

const includesAny = (text: string, values: string[]): boolean =>
  values.some((value) => text.includes(value));

export const triageMessage = (message: string): TriageResult => {
  const text = message.toLowerCase();
  const rationale: string[] = [];

  let taskType: TriageResult["taskType"] = "unknown";
  let severity: TriageResult["severity"] = "medium";
  let confidence = 0.55;

  if (includesAny(text, ["wrong data", "incorrect data", "stale data", "segment"])) {
    taskType = "data-issue";
    confidence = 0.87;
    rationale.push("Detected data correctness language in the request.");
  }

  if (includesAny(text, ["backend", "api", "endpoint", "response", "server"])) {
    taskType = taskType === "unknown" ? "api-issue" : taskType;
    confidence = Math.max(confidence, 0.8);
    rationale.push("Detected backend/API language in the request.");
  }

  if (includesAny(text, ["slow", "latency", "timeout", "performance"])) {
    taskType = "performance";
    severity = "high";
    confidence = Math.max(confidence, 0.82);
    rationale.push("Detected performance-related language.");
  }

  if (includesAny(text, ["urgent", "prod", "production", "critical", "broken"])) {
    severity = "high";
    confidence = Math.max(confidence, 0.86);
    rationale.push("Detected urgency or production-impact language.");
  }

  if (includesAny(text, ["page", "ui", "frontend"])) {
    taskType = taskType === "unknown" ? "ui-issue" : taskType;
    rationale.push("Detected page/UI language, likely tied to a user-facing surface.");
  }

  if (taskType === "unknown") {
    taskType = "bugfix";
    rationale.push("Defaulted to generic bugfix classification.");
  }

  if (rationale.length === 0) {
    rationale.push("No strong heuristics matched; using default triage.");
  }

  return {
    taskType,
    severity,
    confidence,
    rationale,
  };
};
