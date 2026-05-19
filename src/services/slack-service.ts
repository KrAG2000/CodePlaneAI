import { config } from "../config";
import { ExecutionRecord } from "../types";

const postToSlack = async (text: string): Promise<void> => {
  if (!config.slackIncomingWebhookUrl) {
    return;
  }

  const response = await fetch(config.slackIncomingWebhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed with status ${response.status}`);
  }
};

export const notifyExecutionCreated = async (
  record: ExecutionRecord,
): Promise<void> => {
  await postToSlack(
    [
      `CodePlaneAI created execution ${record.id}`,
      `Trigger: ${record.message}`,
      `Triage: ${record.triage.taskType} / ${record.triage.severity}`,
      `Codex handoff: ${record.handoffPath ?? "not written"}`,
    ].join("\n"),
  );
};

export const notifyExecutionFinished = async (
  record: ExecutionRecord,
): Promise<void> => {
  await postToSlack(
    [
      `CodePlaneAI finished execution ${record.id}`,
      `Status: ${record.status}`,
      record.gitOutcome?.branchName ? `Branch: ${record.gitOutcome.branchName}` : "",
      record.gitOutcome?.prUrl ? `PR: ${record.gitOutcome.prUrl}` : "",
      record.gitOutcome?.reasons.length
        ? `Notes: ${record.gitOutcome.reasons.join("; ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
};
