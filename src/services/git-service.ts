import fs from "fs";
import { execSync } from "child_process";
import { minimatch } from "minimatch";
import { Octokit } from "@octokit/rest";
import simpleGit from "simple-git";
import { config } from "../config";
import { GitOutcome, ValidationResult } from "../types";
import { slugify } from "../utils";

const hasRepoPath = (): boolean =>
  Boolean(config.localRepoPath) && fs.existsSync(config.localRepoPath);

const hasProtectedPathViolations = (changedFiles: string[]): string[] =>
  changedFiles.filter((file) =>
    config.protectedPaths.some((pattern) => minimatch(file, pattern)),
  );

export const runValidation = (): ValidationResult => {
  if (!hasRepoPath()) {
    return {
      success: true,
      checks: [
        {
          command: "validation-skipped",
          success: true,
          output: "LOCAL_REPO_PATH is not configured yet, so validation was skipped.",
        },
      ],
    };
  }

  if (config.validationCommands.length === 0) {
    return {
      success: true,
      checks: [
        {
          command: "validation-skipped",
          success: true,
          output: "No validation commands were configured.",
        },
      ],
    };
  }

  const checks = config.validationCommands.map((command) => {
    try {
      const output = execSync(command, {
        cwd: config.localRepoPath,
        encoding: "utf8",
        stdio: "pipe",
      });

      return {
        command,
        success: true,
        output: output.trim(),
      };
    } catch (error) {
      const output = error instanceof Error ? error.message : String(error);
      return {
        command,
        success: false,
        output,
      };
    }
  });

  return {
    success: checks.every((check) => check.success),
    checks,
  };
};

export const finalizeGitFlow = async (
  executionId: string,
  message: string,
  changedFiles: string[],
): Promise<GitOutcome> => {
  if (!hasRepoPath()) {
    return {
      branchName: "",
      skipped: true,
      reasons: ["LOCAL_REPO_PATH is not configured yet, so git finalization was skipped."],
    };
  }

  const protectedViolations = hasProtectedPathViolations(changedFiles);
  if (protectedViolations.length > 0) {
    return {
      branchName: "",
      skipped: true,
      reasons: [
        `Blocked by protected path policy: ${protectedViolations.join(", ")}`,
      ],
    };
  }

  const git = simpleGit(config.localRepoPath);

  if (config.requireCleanWorktree) {
    const status = await git.status();
    if (!status.isClean()) {
      return {
        branchName: "",
        skipped: true,
        reasons: ["Worktree is not clean and REQUIRE_CLEAN_WORKTREE is enabled."],
      };
    }
  }

  const branchName = `codeplane/${executionId}-${slugify(message)}`;
  await git.checkout(config.githubBaseBranch);
  await git.pull(config.githubRemote, config.githubBaseBranch);
  await git.checkoutLocalBranch(branchName);
  await git.add(changedFiles);
  await git.commit(`fix: ${message}`);

  const commitSha = (await git.revparse(["HEAD"])).trim();

  if (config.enableGitPush) {
    await git.push(config.githubRemote, branchName, { "--set-upstream": null });
  }

  let prUrl: string | undefined;

  if (config.enableGithubPr && config.githubToken && config.githubOwner && config.githubRepo) {
    const octokit = new Octokit({ auth: config.githubToken });
    const response = await octokit.pulls.create({
      owner: config.githubOwner,
      repo: config.githubRepo,
      title: `fix: ${message}`,
      head: branchName,
      base: config.githubBaseBranch,
      body: [
        "## CodePlaneAI MVP PR",
        "",
        `Execution ID: \`${executionId}\``,
        `Trigger: ${message}`,
        "",
        "Changed files:",
        ...changedFiles.map((file) => `- \`${file}\``),
      ].join("\n"),
    });

    prUrl = response.data.html_url;
  }

  return {
    branchName,
    commitSha,
    prUrl,
    skipped: false,
    reasons: [],
  };
};
