import fs from "fs";
import path from "path";
import { config } from "../config";
import { ExecutionRecord } from "../types";

export const writeCodexHandoff = (record: ExecutionRecord): string => {
  fs.mkdirSync(config.codexHandoffDir, { recursive: true });

  const filePath = path.join(config.codexHandoffDir, `${record.id}.md`);
  const content = [
    `# CodePlaneAI Handoff: ${record.id}`,
    "",
    "## Trigger",
    "",
    record.message,
    "",
    "## Repo",
    "",
    `- GitHub: ${config.githubOwner}/${config.githubRepo}`,
    `- Local path: ${config.localRepoPath || "not configured"}`,
    `- Base branch: ${config.githubBaseBranch}`,
    "",
    "## Triage",
    "",
    `- Type: ${record.triage.taskType}`,
    `- Severity: ${record.triage.severity}`,
    `- Confidence: ${record.triage.confidence}`,
    "",
    "## Plan For Codex",
    "",
    record.plan.handoffPrompt,
    "",
    "## After Codex Finishes",
    "",
    config.enableAgentAutoRun
      ? "The configured agent runner will finalize this execution automatically after it finishes."
      : "Call the agent-result endpoint with the summary and changed files:",
    "",
    ...(config.enableAgentAutoRun
      ? []
      : [
          "```bash",
          `curl -X POST http://localhost:${config.port}/api/executions/${record.id}/agent-result \\`,
          "  -H 'content-type: application/json' \\",
          "  -H 'x-api-token: <API_TRIGGER_TOKEN>' \\",
          "  -d '{",
          '    "summary": "Describe what Codex changed",',
          '    "changedFiles": ["path/to/file.ts"]',
          "  }'",
          "```",
        ]),
    "",
  ].join("\n");

  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
};

export const readCodexHandoff = (handoffPath: string): string =>
  fs.readFileSync(handoffPath, "utf8");
