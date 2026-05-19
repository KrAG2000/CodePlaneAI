export type AiProtocol =
  | "openai-responses"
  | "openai-chat"
  | "anthropic-messages"
  | "google-gemini-generate-content";

export type AiAuthType = "bearer" | "header" | "query";
export type AiStructuredOutputMode = "native" | "prompted";

export interface AiAuthConfig {
  type: AiAuthType;
  apiKey?: string;
  headerName?: string;
  prefix?: string;
  queryParam?: string;
}

export interface AiModelConfig {
  id: string;
  displayName: string;
  providerName: string;
  platformName: string;
  protocol: AiProtocol;
  baseUrl: string;
  endpointPath: string;
  model: string;
  method?: "POST";
  auth: AiAuthConfig;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  defaults?: {
    maxOutputTokens?: number;
    temperature?: number;
    timeoutMs?: number;
  };
  capabilities?: {
    systemMessage?: boolean;
    structuredOutputMode?: AiStructuredOutputMode;
  };
  metadata?: Record<string, string>;
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiStructuredOutputConfig {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}

export interface AiGenerationRequest {
  modelId: string;
  messages: AiMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  structuredOutput?: AiStructuredOutputConfig;
}

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AiGenerationResponse {
  modelId: string;
  providerName: string;
  platformName: string;
  externalModel: string;
  requestUrl: string;
  text: string;
  parsedOutput?: unknown;
  finishReason?: string;
  usage?: AiUsage;
  rawResponse: unknown;
}

export interface ProviderHttpRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: Record<string, unknown>;
  timeoutMs: number;
}

export interface AiProviderAdapter {
  protocol: AiProtocol;
  buildRequest: (
    config: AiModelConfig,
    request: AiGenerationRequest,
  ) => ProviderHttpRequest;
  parseResponse: (
    config: AiModelConfig,
    request: AiGenerationRequest,
    payload: unknown,
    requestUrl: string,
  ) => AiGenerationResponse;
}
