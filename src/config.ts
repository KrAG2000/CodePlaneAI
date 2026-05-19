import dotenv from "dotenv";
import path from "path";

dotenv.config();

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  return value.toLowerCase() === "true";
};

const toList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const config = {
  port: Number(process.env.PORT ?? 3000),
  logLevel: process.env.LOG_LEVEL ?? "info",
  apiTriggerToken: process.env.API_TRIGGER_TOKEN ?? "change-me",
  localRepoPath: process.env.LOCAL_REPO_PATH
    ? path.resolve(process.env.LOCAL_REPO_PATH)
    : "",
  githubOwner: process.env.GITHUB_OWNER ?? "KrAG2000",
  githubRepo: process.env.GITHUB_REPO ?? "CodePlaneAI",
  githubBaseBranch: process.env.GITHUB_BASE_BRANCH ?? "main",
  githubRemote: process.env.GITHUB_REMOTE ?? "origin",
  githubToken: process.env.GITHUB_TOKEN ?? "",
  enableGithubPr: toBoolean(process.env.ENABLE_GITHUB_PR, false),
  enableGitPush: toBoolean(process.env.ENABLE_GIT_PUSH, true),
  autoCommitOnAgentResult: toBoolean(
    process.env.AUTO_COMMIT_ON_AGENT_RESULT,
    true,
  ),
  requireCleanWorktree: toBoolean(process.env.REQUIRE_CLEAN_WORKTREE, false),
  validationCommands: toList(process.env.VALIDATION_COMMANDS),
  protectedPaths: toList(process.env.PROTECTED_PATHS),
  slackIncomingWebhookUrl: process.env.SLACK_INCOMING_WEBHOOK_URL ?? "",
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET ?? "",
  slackVerificationToken: process.env.SLACK_VERIFICATION_TOKEN ?? "",
  enableCodexAutoRun: toBoolean(process.env.ENABLE_CODEX_AUTO_RUN, false),
  codexCommand: process.env.CODEX_COMMAND ?? "codex",
  codexSandbox: process.env.CODEX_SANDBOX ?? "workspace-write",
  codexApprovalPolicy: process.env.CODEX_APPROVAL_POLICY ?? "never",
  codexHandoffDir: process.env.CODEX_HANDOFF_DIR
    ? path.resolve(process.env.CODEX_HANDOFF_DIR)
    : path.resolve(".data", "handoffs"),
  dataDir: path.resolve(".data"),
};
