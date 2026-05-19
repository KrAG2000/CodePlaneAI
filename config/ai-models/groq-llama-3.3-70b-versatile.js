module.exports = {
  id: "groq-llama-3.3-70b-versatile",
  displayName: "Groq Llama 3.3 70B Versatile",
  providerName: "groq",
  platformName: "Groq API",
  protocol: "openai-chat",
  baseUrl: "https://api.groq.com/openai/v1",
  endpointPath: "/chat/completions",
  model: "llama-3.3-70b-versatile",
  auth: {
    type: "bearer",
    apiKey: process.env.GROQ_API_KEY ?? "",
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
