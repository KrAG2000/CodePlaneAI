import { AiProviderAdapter } from "../types";
import {
  buildBaseHttpRequest,
  buildPromptedJsonInstruction,
  ensureText,
  safeJsonParse,
} from "./common";

const extractChatContent = (payload: unknown): string | undefined => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("choices" in payload) ||
    !Array.isArray(payload.choices) ||
    payload.choices.length === 0
  ) {
    return undefined;
  }

  const firstChoice = payload.choices[0];
  if (
    typeof firstChoice !== "object" ||
    firstChoice === null ||
    !("message" in firstChoice) ||
    typeof firstChoice.message !== "object" ||
    firstChoice.message === null ||
    !("content" in firstChoice.message)
  ) {
    return undefined;
  }

  const content = firstChoice.message.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
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
      .join("\n");
  }

  return undefined;
};

export const openAiChatAdapter: AiProviderAdapter = {
  protocol: "openai-chat",
  buildRequest(modelConfig, request) {
    const baseRequest = buildBaseHttpRequest(modelConfig);
    const promptedJsonInstruction =
      modelConfig.capabilities?.structuredOutputMode === "prompted"
        ? buildPromptedJsonInstruction(request)
        : undefined;

    const messages = [
      ...(promptedJsonInstruction
        ? [{ role: "system", content: promptedJsonInstruction }]
        : []),
      ...request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const body: Record<string, unknown> = {
      model: modelConfig.model,
      messages,
      max_tokens: request.maxOutputTokens ?? modelConfig.defaults?.maxOutputTokens ?? 1000,
    };

    const temperature = request.temperature ?? modelConfig.defaults?.temperature;
    if (temperature != null) {
      body.temperature = temperature;
    }

    if (
      request.structuredOutput &&
      modelConfig.capabilities?.structuredOutputMode !== "prompted"
    ) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: request.structuredOutput.name,
          schema: request.structuredOutput.schema,
          strict: request.structuredOutput.strict ?? true,
        },
      };
    }

    return {
      ...baseRequest,
      body,
    };
  },
  parseResponse(modelConfig, request, payload, requestUrl) {
    const text = ensureText(extractChatContent(payload), modelConfig.id);

    const firstChoice =
      typeof payload === "object" &&
      payload !== null &&
      "choices" in payload &&
      Array.isArray(payload.choices) &&
      payload.choices.length > 0
        ? payload.choices[0]
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
        typeof firstChoice === "object" &&
        firstChoice !== null &&
        "finish_reason" in firstChoice &&
        typeof firstChoice.finish_reason === "string"
          ? firstChoice.finish_reason
          : undefined,
      usage:
        typeof payload === "object" &&
        payload !== null &&
        "usage" in payload &&
        typeof payload.usage === "object" &&
        payload.usage !== null
          ? {
              inputTokens:
                "prompt_tokens" in payload.usage &&
                typeof payload.usage.prompt_tokens === "number"
                  ? payload.usage.prompt_tokens
                  : undefined,
              outputTokens:
                "completion_tokens" in payload.usage &&
                typeof payload.usage.completion_tokens === "number"
                  ? payload.usage.completion_tokens
                  : undefined,
              totalTokens:
                "total_tokens" in payload.usage &&
                typeof payload.usage.total_tokens === "number"
                  ? payload.usage.total_tokens
                  : undefined,
            }
          : undefined,
      rawResponse: payload,
    };
  },
};
