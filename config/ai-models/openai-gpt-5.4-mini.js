module.exports = {
  id: "openai-gpt-5.4-mini",
  displayName: "OpenAI GPT-5.4 Mini",
  providerName: "openai",
  platformName: "OpenAI",
  protocol: "openai-responses",
  baseUrl: "https://api.openai.com/v1",
  endpointPath: "/responses",
  model: "gpt-5.4-mini",
  auth: {
    type: "bearer",
    apiKey: process.env.OPENAI_API_KEY ?? "",
    prefix: "Bearer",
  },
  defaults: {
    maxOutputTokens: 500,
    temperature: 0.1,
    timeoutMs: 30000,
  },
  capabilities: {
    systemMessage: true,
    structuredOutputMode: "native",
  },
};
