import { z } from "zod";
import { generateAiResponse } from "../ai/client";
import { config } from "../config";
import { Severity, TaskType, TriageResult } from "../types";

const triageSchema = z.object({
  taskType: z.nativeEnum(TaskType),
  severity: z.nativeEnum(Severity),
  confidence: z.number().min(0).max(1),
  repoHint: z.union([z.string().min(1), z.literal(""), z.null()]),
  rationale: z.array(z.string().min(1)).min(1).max(4),
});

const triageJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    taskType: {
      type: "string",
      enum: Object.values(TaskType),
    },
    severity: {
      type: "string",
      enum: Object.values(Severity),
    },
    confidence: {
      type: "number",
    },
    repoHint: {
      type: "string",
    },
    rationale: {
      type: "array",
      items: {
        type: "string",
      },
    },
  },
  required: ["taskType", "severity", "confidence", "repoHint", "rationale"],
} as const;

const buildUnavailableTriage = (reason: string): TriageResult => ({
  taskType: TaskType.Unknown,
  severity: Severity.Medium,
  confidence: 0.2,
  rationale: [reason],
});

const buildPrompt = (message: string): string =>
  [
    "Classify the engineering request into exactly one fixed category.",
    `Allowed task categories: ${Object.values(TaskType).join(", ")}.`,
    `Allowed severities: ${Object.values(Severity).join(", ")}.`,
    "Pick the most specific category that best describes the user's request.",
    "Use higher severity only when the request implies user impact, production risk, security risk, or broad breakage.",
    "Keep rationale concise and evidence-based.",
    "",
    "Engineering request:",
    message,
  ].join("\n");

const getTriageModelChain = (): string[] => {
  const ordered = [config.triageModelId, ...config.triageFallbackModelIds];
  return [...new Set(ordered.filter(Boolean))];
};

const normalizeStructuredTriage = (payload: unknown) => {
  if (typeof payload !== "object" || payload === null) {
    return payload;
  }

  const candidate = payload as Record<string, unknown>;
  if (candidate.repoHint === "") {
    return {
      ...candidate,
      repoHint: null,
    };
  }

  return candidate;
};

const classifyWithConfiguredModels = async (message: string): Promise<TriageResult> => {
  const failures: string[] = [];

  for (const modelId of getTriageModelChain()) {
    try {
      const response = await generateAiResponse({
        modelId,
        messages: [
          {
            role: "system",
            content:
              "You are an engineering triage classifier. Return only the requested structured output.",
          },
          {
            role: "user",
            content: buildPrompt(message),
          },
        ],
        maxOutputTokens: 300,
        structuredOutput: {
          name: "triage_result",
          schema: triageJsonSchema,
          strict: true,
        },
      });

      const parsed = triageSchema.parse(
        normalizeStructuredTriage(response.parsedOutput ?? JSON.parse(response.text)),
      );
      return {
        taskType: parsed.taskType,
        severity: parsed.severity,
        confidence: parsed.confidence,
        repoHint: parsed.repoHint || undefined,
        rationale: parsed.rationale,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`${modelId}: ${reason}`);
    }
  }

  throw new Error(failures.join(" | "));
};

export const triageMessage = async (message: string): Promise<TriageResult> => {
  if (!config.triageModelId) {
    return buildUnavailableTriage(
      "AI triage is unavailable because TRIAGE_MODEL_ID is not configured.",
    );
  }

  try {
    return await classifyWithConfiguredModels(message);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return buildUnavailableTriage(`AI triage failed: ${reason}`);
  }
};
