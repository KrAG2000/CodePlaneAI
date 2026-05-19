import { AiProviderAdapter } from "../types";
import { anthropicMessagesAdapter } from "./anthropic-messages";
import { googleGeminiGenerateContentAdapter } from "./google-gemini-generate-content";
import { openAiChatAdapter } from "./openai-chat";
import { openAiResponsesAdapter } from "./openai-responses";

const adapters: AiProviderAdapter[] = [
  openAiResponsesAdapter,
  openAiChatAdapter,
  anthropicMessagesAdapter,
  googleGeminiGenerateContentAdapter,
];

export const getProviderAdapter = (protocol: string): AiProviderAdapter => {
  const adapter = adapters.find((item) => item.protocol === protocol);

  if (!adapter) {
    throw new Error(`Unsupported AI protocol: ${protocol}`);
  }

  return adapter;
};
