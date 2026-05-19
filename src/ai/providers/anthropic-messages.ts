import { AiProviderAdapter } from "../types";
import {
  buildBaseHttpRequest,
  buildPromptedJsonInstruction,
  ensureText,
  safeJsonParse,
  splitSystemMessages,
} from "./common";

const extractAnthropicText = (payload: unknown): string | undefined => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("content" in payload) ||
    !Array.isArray(payload.content)
  ) {
    return undefined;
  }

  return payload.content
    .map((part) => {
      if (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "text" &&
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

export const anthropicMessagesAdapter: AiProviderAdapter = {
  protocol: "anthropic-messages",
  buildRequest(modelConfig, request) {
    const baseRequest = buildBaseHttpRequest(modelConfig);
    const { system, conversation } = splitSystemMessages(request.messages);
    const promptedJsonInstruction =
      modelConfig.capabilities?.structuredOutputMode === "prompted"
        ? buildPromptedJsonInstruction(request)
        : undefined;
    const systemText = [promptedJsonInstruction, ...system].filter(Boolean).join("\n\n");

    const body: Record<string, unknown> = {
      model: modelConfig.model,
      max_tokens:
        request.maxOutputTokens ?? modelConfig.defaults?.maxOutputTokens ?? 1000,
      messages: conversation.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    };

    if (systemText) {
      body.system = systemText;
    }

    const temperature = request.temperature ?? modelConfig.defaults?.temperature;
    if (temperature != null) {
      body.temperature = temperature;
    }

    if (
      request.structuredOutput &&
      modelConfig.capabilities?.structuredOutputMode !== "prompted"
    ) {
      body.output_config = {
        format: {
          type: "json_schema",
          schema: request.structuredOutput.schema,
        },
      };
    }

    return {
      ...baseRequest,
      body,
    };
  },
  parseResponse(modelConfig, request, payload, requestUrl) {
    const text = ensureText(extractAnthropicText(payload), modelConfig.id);

    return {
      modelId: modelConfig.id,
      providerName: modelConfig.providerName,
      platformName: modelConfig.platformName,
      externalModel: modelConfig.model,
      requestUrl,
      text,
      parsedOutput: request.structuredOutput ? safeJsonParse(text) : undefined,
      finishReason:
        typeof payload === "object" &&
        payload !== null &&
        "stop_reason" in payload &&
        typeof payload.stop_reason === "string"
          ? payload.stop_reason
          : undefined,
      usage:
        typeof payload === "object" &&
        payload !== null &&
        "usage" in payload &&
        typeof payload.usage === "object" &&
        payload.usage !== null
          ? {
              inputTokens:
                "input_tokens" in payload.usage &&
                typeof payload.usage.input_tokens === "number"
                  ? payload.usage.input_tokens
                  : undefined,
              outputTokens:
                "output_tokens" in payload.usage &&
                typeof payload.usage.output_tokens === "number"
                  ? payload.usage.output_tokens
                  : undefined,
            }
          : undefined,
      rawResponse: payload,
    };
  },
};
