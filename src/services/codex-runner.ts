import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { config } from "../config";
import { AgentResult, ExecutionRecord } from "../types";
import { nowIso, slugify } from "../utils";
import { detectChangedFiles, prepareExecutionBranch } from "./git-service";
import { readCodexHandoff } from "./handoff-service";

interface AgentCompletionHooks {
  onComplete: (executionId: string, agentResult: AgentResult) => Promise<void>;
  onFailure: (
    executionId: string,
    reason: string,
    agentRunPatch?: Partial<ExecutionRecord["agentRun"]>,
  ) => Promise<void>;
}

const writeAgentEvent = (
  logStream: fs.WriteStream,
  executionId: string,
  level: "INFO" | "ERROR" | "WARN",
  message: string,
): void => {
  const line = `[${nowIso()}] [${level}] [${executionId}] ${message}`;
  logStream.write(`${line}\n`);

  if (level === "ERROR") {
    console.error(line);
    return;
  }

  if (level === "WARN") {
    console.warn(line);
    return;
  }

  console.info(line);
};

const buildExecutionBranchName = (record: ExecutionRecord): string =>
  `codeplane/${record.id}-${slugify(record.message)}`;

const buildAgentArgs = (
  provider: "codex" | "claude",
  cwd: string,
  prompt: string,
  responsePath: string,
): string[] => {
  if (provider === "claude") {
    const args = [
      "-p",
      "--output-format",
      "text",
      "--dangerously-skip-permissions",
    ];

    if (config.agentModel) {
      args.push("--model", config.agentModel);
    }

    return [...args, prompt];
  }

  const args = [
    "exec",
    "--full-auto",
    "--cwd",
    cwd,
    "--sandbox",
    config.codexSandbox,
    "--output-last-message",
    responsePath,
  ];

  if (config.agentModel) {
    args.push("--model", config.agentModel);
  }

  return [...args, prompt];
};

const readAgentSummary = (
  provider: "codex" | "claude",
  responsePath: string,
  stdout: string,
): string => {
  if (provider === "codex" && fs.existsSync(responsePath)) {
    const saved = fs.readFileSync(responsePath, "utf8").trim();
    if (saved) {
      return saved;
    }
  }

  const trimmed = stdout.trim();
  if (trimmed) {
    return trimmed;
  }

  return `Automated ${provider} run completed successfully.`;
};

export const startCodexRun = (
  record: ExecutionRecord,
  hooks: AgentCompletionHooks,
): ExecutionRecord => {
  if (!config.enableAgentAutoRun || !record.handoffPath) {
    console.info(
      `[${nowIso()}] [INFO] [${record.id}] Agent auto-run skipped because ENABLE_AGENT_AUTO_RUN is disabled or handoffPath is missing.`,
    );
    return record;
  }

  const provider = config.agentProvider === "claude" ? "claude" : "codex";
  const runDir = path.join(config.dataDir, "agent-runs");
  fs.mkdirSync(runDir, { recursive: true });

  const logPath = path.join(runDir, `${record.id}.log`);
  const responsePath = path.join(runDir, `${record.id}.response.txt`);
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  const prompt = readCodexHandoff(record.handoffPath);
  const cwd = config.localRepoPath || process.cwd();
  const branchName = buildExecutionBranchName(record);
  const args = buildAgentArgs(provider, cwd, prompt, responsePath);

  writeAgentEvent(
    logStream,
    record.id,
    "INFO",
    `Preparing automated agent run with provider=${provider}, branch=${branchName}.`,
  );
  logStream.write(
    `Command: ${config.agentCommand} ${args.map((arg) => JSON.stringify(arg)).join(" ")}\n\n`,
  );

  void prepareExecutionBranch(record.id, record.message)
    .then(() => {
      writeAgentEvent(
        logStream,
        record.id,
        "INFO",
        `Execution branch prepared successfully: ${branchName}.`,
      );

      const child = spawn(config.agentCommand, args, {
        cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      writeAgentEvent(
        logStream,
        record.id,
        "INFO",
        `Agent triggered successfully with PID ${child.pid ?? "unknown"}.`,
      );
      const timeout = setTimeout(() => {
        writeAgentEvent(
          logStream,
          record.id,
          "ERROR",
          `Agent timed out after ${config.agentTimeoutMs}ms.`,
        );
        child.kill("SIGTERM");
      }, config.agentTimeoutMs);

      const stdoutChunks: string[] = [];
      child.stdout.pipe(logStream);
      child.stderr.pipe(logStream);
      child.stdout.on("data", (chunk: Buffer | string) => {
        stdoutChunks.push(chunk.toString());
      });

      child.on("exit", (code, signal) => {
        clearTimeout(timeout);
        writeAgentEvent(
          logStream,
          record.id,
          code === 0 ? "INFO" : "ERROR",
          `Agent process exited with code=${code ?? "none"} signal=${signal ?? "none"}.`,
        );
        logStream.end();

        void (async () => {
          if (code !== 0) {
            await hooks.onFailure(
              record.id,
              `Agent exited unsuccessfully with code ${code ?? "none"} and signal ${signal ?? "none"}.`,
              {
                completedAt: nowIso(),
                exitCode: code ?? undefined,
                signal: signal ?? undefined,
                lastError: stdoutChunks.join("").trim() || "No agent output captured.",
              },
            );
            return;
          }

          const changedFiles = await detectChangedFiles();
          if (changedFiles.length === 0) {
            await hooks.onFailure(
              record.id,
              "Agent completed but did not produce file changes.",
              {
                completedAt: nowIso(),
                exitCode: code ?? undefined,
                signal: signal ?? undefined,
              },
            );
            return;
          }

          await hooks.onComplete(record.id, {
            summary: readAgentSummary(
              provider,
              responsePath,
              stdoutChunks.join(""),
            ).slice(0, 4000),
            changedFiles,
          });
        })();
      });

      child.on("error", (error) => {
        clearTimeout(timeout);
        writeAgentEvent(
          logStream,
          record.id,
          "ERROR",
          `Failed to start agent process: ${error.message}`,
        );
        logStream.end();
        void hooks.onFailure(record.id, "Failed to start agent process.", {
          completedAt: nowIso(),
          lastError: error.message,
        });
      });
    })
    .catch((error) => {
      writeAgentEvent(
        logStream,
        record.id,
        "ERROR",
        `Failed to prepare execution branch: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      logStream.end();
      void hooks.onFailure(record.id, "Failed to prepare execution branch.", {
        completedAt: nowIso(),
        lastError: error instanceof Error ? error.message : String(error),
      });
    });

  return {
    ...record,
    status: "agent_running",
    agentRun: {
      provider,
      startedAt: nowIso(),
      command: `${config.agentCommand} ${args.join(" ")}`,
      logPath,
      responsePath,
      branchName,
    },
  };
};
