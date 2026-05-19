module.exports = {
  id: "anthropic-claude-sonnet-4-5",
  displayName: "Anthropic Claude Sonnet 4.5",
  providerName: "anthropic",
  platformName: "Claude API",
  protocol: "anthropic-messages",
  baseUrl: "https://api.anthropic.com",
  endpointPath: "/v1/messages",
  model: "claude-sonnet-4-5",
  auth: {
    type: "header",
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    headerName: "x-api-key",
  },
  headers: {
    "anthropic-version": "2023-06-01",
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
