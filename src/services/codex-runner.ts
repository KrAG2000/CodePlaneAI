import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { config } from "../config";
import { ExecutionRecord } from "../types";
import { nowIso } from "../utils";
import { readCodexHandoff } from "./handoff-service";

export const startCodexRun = (record: ExecutionRecord): ExecutionRecord => {
  if (!config.enableCodexAutoRun || !record.handoffPath) {
    return record;
  }

  const runDir = path.join(config.dataDir, "agent-runs");
  fs.mkdirSync(runDir, { recursive: true });

  const logPath = path.join(runDir, `${record.id}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  const prompt = readCodexHandoff(record.handoffPath);
  const cwd = config.localRepoPath || process.cwd();
  const args = [
    "exec",
    "--cd",
    cwd,
    "--sandbox",
    config.codexSandbox,
    "--ask-for-approval",
    config.codexApprovalPolicy,
    prompt,
  ];

  const child = spawn(config.codexCommand, args, {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  logStream.write(`Started at: ${nowIso()}\n`);
  logStream.write(`Command: ${config.codexCommand} ${args.map((arg) => JSON.stringify(arg)).join(" ")}\n\n`);

  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  child.on("exit", (code, signal) => {
    logStream.write(`\nExited at: ${nowIso()}\n`);
    logStream.write(`Code: ${code ?? "none"}\n`);
    logStream.write(`Signal: ${signal ?? "none"}\n`);
    logStream.end();
  });

  child.on("error", (error) => {
    logStream.write(`\nFailed to start Codex: ${error.message}\n`);
    logStream.end();
  });

  return {
    ...record,
    agentRun: {
      provider: "codex",
      startedAt: nowIso(),
      command: `${config.codexCommand} ${args.join(" ")}`,
      logPath,
    },
  };
};
