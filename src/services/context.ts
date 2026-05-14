import fs from "fs";
import path from "path";
import { config } from "../config";
import { TriageResult } from "../types";
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

  if (text.includes("backend") || triage.taskType === "api-issue") {
    relevantAreas.push("backend services", "API handlers", "response serializers");
  }

  if (text.includes("segment") || text.includes("wrong data") || triage.taskType === "data-issue") {
    relevantAreas.push("data fetching logic", "query/filter builders", "transformation mappers");
  }

  if (text.includes("page") || triage.taskType === "ui-issue") {
    relevantAreas.push("page-level API integration", "view-model mapping");
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
