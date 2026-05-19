module.exports = {
  id: "google-gemini-2.5-flash",
  displayName: "Google Gemini 2.5 Flash",
  providerName: "google",
  platformName: "Gemini API",
  protocol: "google-gemini-generate-content",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  endpointPath: "/models/{model}:generateContent",
  model: "gemini-2.5-flash",
  auth: {
    type: "query",
    apiKey: process.env.GEMINI_API_KEY ?? "",
    queryParam: "key",
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
