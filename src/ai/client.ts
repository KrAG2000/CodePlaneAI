import { getAiModelConfig, listAiModelConfigs } from "./config-registry";
import { getProviderAdapter } from "./providers";
import { AiGenerationRequest, AiGenerationResponse } from "./types";

export const listAvailableAiModels = () => listAiModelConfigs();

export const generateAiResponse = async (
  request: AiGenerationRequest,
): Promise<AiGenerationResponse> => {
  const modelConfig = getAiModelConfig(request.modelId);
  const adapter = getProviderAdapter(modelConfig.protocol);
  const httpRequest = adapter.buildRequest(modelConfig, request);

  const response = await fetch(httpRequest.url, {
    method: httpRequest.method,
    headers: httpRequest.headers,
    body: JSON.stringify(httpRequest.body),
    signal: AbortSignal.timeout(httpRequest.timeoutMs),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(
      `AI request failed for model "${modelConfig.id}" with status ${response.status}: ${rawText}`,
    );
  }

  const payload = JSON.parse(rawText) as unknown;
  return adapter.parseResponse(modelConfig, request, payload, httpRequest.url);
};
