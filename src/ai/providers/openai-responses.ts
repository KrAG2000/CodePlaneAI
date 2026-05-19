import { AiProviderAdapter } from "../types";
import {
  buildBaseHttpRequest,
  buildPromptedJsonInstruction,
  ensureText,
  safeJsonParse,
  splitSystemMessages,
} from "./common";

const extractOutputText = (payload: unknown): string | undefined => {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "output" in payload &&
    Array.isArray(payload.output)
  ) {
    const fragments = payload.output
      .flatMap((item) => {
        if (
          typeof item === "object" &&
          item !== null &&
          "content" in item &&
          Array.isArray(item.content)
        ) {
          return item.content;
        }

        return [];
      })
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
      .filter(Boolean);

    return fragments.join("\n").trim() || undefined;
  }

  return undefined;
};

export const openAiResponsesAdapter: AiProviderAdapter = {
  protocol: "openai-responses",
  buildRequest(modelConfig, request) {
    const baseRequest = buildBaseHttpRequest(modelConfig);
    const { system, conversation } = splitSystemMessages(request.messages);
    const promptedJsonInstruction =
      modelConfig.capabilities?.structuredOutputMode === "prompted"
        ? buildPromptedJsonInstruction(request)
        : undefined;
    const systemText = [promptedJsonInstruction, ...system].filter(Boolean).join("\n\n");

    const input = [
      ...(systemText
        ? [
            {
              role: "system",
              content: [{ type: "input_text", text: systemText }],
            },
          ]
        : []),
      ...conversation.map((message) => ({
        role: message.role,
        content: [{ type: "input_text", text: message.content }],
      })),
    ];

    const body: Record<string, unknown> = {
      model: modelConfig.model,
      input,
      max_output_tokens:
        request.maxOutputTokens ?? modelConfig.defaults?.maxOutputTokens ?? 1000,
    };

    const temperature = request.temperature ?? modelConfig.defaults?.temperature;
    if (temperature != null) {
      body.temperature = temperature;
    }

    if (
      request.structuredOutput &&
      modelConfig.capabilities?.structuredOutputMode !== "prompted"
    ) {
      body.text = {
        format: {
          type: "json_schema",
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
    const text = ensureText(extractOutputText(payload), modelConfig.id);

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
        "status" in payload &&
        typeof payload.status === "string"
          ? payload.status
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
