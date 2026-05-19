import { AiProviderAdapter } from "../types";
import {
  buildBaseHttpRequest,
  buildPromptedJsonInstruction,
  ensureText,
  safeJsonParse,
  splitSystemMessages,
} from "./common";

const extractGeminiText = (payload: unknown): string | undefined => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("candidates" in payload) ||
    !Array.isArray(payload.candidates) ||
    payload.candidates.length === 0
  ) {
    return undefined;
  }

  const firstCandidate = payload.candidates[0];
  if (
    typeof firstCandidate !== "object" ||
    firstCandidate === null ||
    !("content" in firstCandidate) ||
    typeof firstCandidate.content !== "object" ||
    firstCandidate.content === null ||
    !("parts" in firstCandidate.content) ||
    !Array.isArray(firstCandidate.content.parts)
  ) {
    return undefined;
  }

  return (firstCandidate.content.parts as unknown[])
    .map((part: unknown) => {
      if (
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
};

export const googleGeminiGenerateContentAdapter: AiProviderAdapter = {
  protocol: "google-gemini-generate-content",
  buildRequest(modelConfig, request) {
    const baseRequest = buildBaseHttpRequest(modelConfig);
    const { system, conversation } = splitSystemMessages(request.messages);
    const promptedJsonInstruction =
      modelConfig.capabilities?.structuredOutputMode === "prompted"
        ? buildPromptedJsonInstruction(request)
        : undefined;
    const systemText = [promptedJsonInstruction, ...system].filter(Boolean).join("\n\n");

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens:
        request.maxOutputTokens ?? modelConfig.defaults?.maxOutputTokens ?? 1000,
    };

    const temperature = request.temperature ?? modelConfig.defaults?.temperature;
    if (temperature != null) {
      generationConfig.temperature = temperature;
    }

    if (
      request.structuredOutput &&
      modelConfig.capabilities?.structuredOutputMode !== "prompted"
    ) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseJsonSchema = request.structuredOutput.schema;
    }

    const body: Record<string, unknown> = {
      contents: conversation.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig,
    };

    if (systemText) {
      body.systemInstruction = {
        parts: [{ text: systemText }],
      };
    }

    return {
      ...baseRequest,
      body,
    };
  },
  parseResponse(modelConfig, request, payload, requestUrl) {
    const text = ensureText(extractGeminiText(payload), modelConfig.id);

    const firstCandidate =
      typeof payload === "object" &&
      payload !== null &&
      "candidates" in payload &&
      Array.isArray(payload.candidates) &&
      payload.candidates.length > 0
        ? payload.candidates[0]
        : undefined;

    return {
      modelId: modelConfig.id,
      providerName: modelConfig.providerName,
      platformName: modelConfig.platformName,
      externalModel: modelConfig.model,
      requestUrl,
      text,
      parsedOutput: request.structuredOutput ? safeJsonParse(text) : undefined,
      finishReason:
        typeof firstCandidate === "object" &&
        firstCandidate !== null &&
        "finishReason" in firstCandidate &&
        typeof firstCandidate.finishReason === "string"
          ? firstCandidate.finishReason
          : undefined,
      usage:
        typeof payload === "object" &&
        payload !== null &&
        "usageMetadata" in payload &&
        typeof payload.usageMetadata === "object" &&
        payload.usageMetadata !== null
          ? {
              inputTokens:
                "promptTokenCount" in payload.usageMetadata &&
                typeof payload.usageMetadata.promptTokenCount === "number"
                  ? payload.usageMetadata.promptTokenCount
                  : undefined,
              outputTokens:
                "candidatesTokenCount" in payload.usageMetadata &&
                typeof payload.usageMetadata.candidatesTokenCount === "number"
                  ? payload.usageMetadata.candidatesTokenCount
                  : undefined,
              totalTokens:
                "totalTokenCount" in payload.usageMetadata &&
                typeof payload.usageMetadata.totalTokenCount === "number"
                  ? payload.usageMetadata.totalTokenCount
                  : undefined,
            }
          : undefined,
      rawResponse: payload,
    };
  },
};
