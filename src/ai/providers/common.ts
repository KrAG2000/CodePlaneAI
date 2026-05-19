import { AiGenerationRequest, AiModelConfig, ProviderHttpRequest } from "../types";

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, "");

export const interpolateEndpointPath = (
  endpointPath: string,
  model: string,
): string => endpointPath.replaceAll("{model}", encodeURIComponent(model));

export const buildUrl = (
  baseUrl: string,
  endpointPath: string,
  query: Record<string, string>,
): string => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/g, "");
  const normalizedPath = trimSlashes(endpointPath);
  const url = new URL(`${normalizedBaseUrl}/${normalizedPath}`);

  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
};

export const resolveApiKey = (modelConfig: AiModelConfig): string => {
  if (modelConfig.auth.apiKey) {
    return modelConfig.auth.apiKey;
  }

  throw new Error(
    `Missing API key for model "${modelConfig.id}". Set auth.apiKey in its model config.`,
  );
};

export const buildBaseHttpRequest = (
  modelConfig: AiModelConfig,
): Omit<ProviderHttpRequest, "body"> => {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(modelConfig.headers ?? {}),
  };

  const query = { ...(modelConfig.query ?? {}) };
  const apiKey = resolveApiKey(modelConfig);

  if (modelConfig.auth.type === "bearer") {
    headers.authorization = `${modelConfig.auth.prefix ?? "Bearer"} ${apiKey}`;
  } else if (modelConfig.auth.type === "header") {
    if (!modelConfig.auth.headerName) {
      throw new Error(`Model "${modelConfig.id}" is missing auth.headerName.`);
    }
    const prefix = modelConfig.auth.prefix ? `${modelConfig.auth.prefix} ` : "";
    headers[modelConfig.auth.headerName] = `${prefix}${apiKey}`;
  } else {
    if (!modelConfig.auth.queryParam) {
      throw new Error(`Model "${modelConfig.id}" is missing auth.queryParam.`);
    }
    query[modelConfig.auth.queryParam] = apiKey;
  }

  return {
    url: buildUrl(
      modelConfig.baseUrl,
      interpolateEndpointPath(modelConfig.endpointPath, modelConfig.model),
      query,
    ),
    method: modelConfig.method ?? "POST",
    headers,
    timeoutMs: modelConfig.defaults?.timeoutMs ?? 30000,
  };
};

export const splitSystemMessages = (
  messages: AiGenerationRequest["messages"],
): {
  system: string[];
  conversation: AiGenerationRequest["messages"];
} => {
  const system: string[] = [];
  const conversation = messages.filter((message) => {
    if (message.role === "system") {
      system.push(message.content);
      return false;
    }

    return true;
  });

  return { system, conversation };
};

export const buildPromptedJsonInstruction = (
  request: AiGenerationRequest,
): string | undefined => {
  if (!request.structuredOutput) {
    return undefined;
  }

  return [
    "Return only valid JSON.",
    "Do not wrap the response in markdown fences.",
    `Schema name: ${request.structuredOutput.name}`,
    `JSON schema: ${JSON.stringify(request.structuredOutput.schema)}`,
  ].join("\n");
};

export const safeJsonParse = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

export const ensureText = (value: string | undefined, modelId: string): string => {
  if (!value) {
    throw new Error(`Provider response for "${modelId}" did not include text output.`);
  }

  return value;
};
