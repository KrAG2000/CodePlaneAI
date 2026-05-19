import fs from "fs";
import path from "path";
import { config } from "../config";
import { TaskType, TriageResult } from "../types";
import { dedupe } from "../utils";

const exists = (targetPath: string): boolean => fs.existsSync(targetPath);

export interface ContextSnapshot {
  repoConfigured: boolean;
  repoPath?: string;
  relevantAreas: string[];
  validationCommands: string[];
  repoSignals: string[];
}

export const buildContext = (message: string, triage: TriageResult): ContextSnapshot => {
  const text = message.toLowerCase();
  const relevantAreas: string[] = [];
  const repoSignals: string[] = [];

  switch (triage.taskType) {
    case TaskType.ApiIssue:
      relevantAreas.push("backend services", "API handlers", "response serializers");
      break;
    case TaskType.DataIssue:
      relevantAreas.push("data fetching logic", "query/filter builders", "transformation mappers");
      break;
    case TaskType.UiIssue:
      relevantAreas.push("page-level API integration", "view-model mapping");
      break;
    case TaskType.Performance:
      relevantAreas.push("performance hotspots", "query execution", "caching layers");
      break;
    case TaskType.Infrastructure:
      relevantAreas.push("deployment configuration", "runtime environment", "operational tooling");
      break;
    case TaskType.Dependency:
      relevantAreas.push("dependency manifests", "lockfiles", "integration boundaries");
      break;
    case TaskType.Security:
      relevantAreas.push("auth flows", "permission checks", "secret handling");
      break;
    case TaskType.TestFailure:
      relevantAreas.push("test suites", "fixtures", "failing assertions");
      break;
    default:
      break;
  }

  if (relevantAreas.length === 0) {
    if (text.includes("backend") || text.includes("api")) {
      relevantAreas.push("backend services", "API handlers", "response serializers");
    }

    if (text.includes("data") || text.includes("mapping") || text.includes("query")) {
      relevantAreas.push("data fetching logic", "query/filter builders", "transformation mappers");
    }

    if (text.includes("page") || text.includes("ui") || text.includes("frontend")) {
      relevantAreas.push("page-level API integration", "view-model mapping");
    }
  }

  if (config.localRepoPath) {
    repoSignals.push(`Configured local repo path: ${config.localRepoPath}`);

    if (exists(path.join(config.localRepoPath, "package.json"))) {
      repoSignals.push("Detected package.json in the target repo.");
    }

    if (exists(path.join(config.localRepoPath, ".git"))) {
      repoSignals.push("Detected a git repository in the target repo path.");
    }
  } else {
    repoSignals.push("No local repo path configured yet.");
  }

  return {
    repoConfigured: Boolean(config.localRepoPath),
    repoPath: config.localRepoPath || undefined,
    relevantAreas: dedupe(relevantAreas.length > 0 ? relevantAreas : ["application logic", "tests"]),
    validationCommands: config.validationCommands,
    repoSignals,
  };
};
