import fs from "fs";
import path from "path";
import { z } from "zod";
import { config } from "../config";
import { AiModelConfig } from "./types";

const authSchema = z.object({
  type: z.enum(["bearer", "header", "query"]),
  apiKey: z.string().optional(),
  headerName: z.string().optional(),
  prefix: z.string().optional(),
  queryParam: z.string().optional(),
});

const modelConfigSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  providerName: z.string().min(1),
  platformName: z.string().min(1),
  protocol: z.enum([
    "openai-responses",
    "openai-chat",
    "anthropic-messages",
    "google-gemini-generate-content",
  ]),
  baseUrl: z.string().min(1),
  endpointPath: z.string().min(1),
  model: z.string().min(1),
  method: z.literal("POST").optional(),
  auth: authSchema,
  headers: z.record(z.string()).optional(),
  query: z.record(z.string()).optional(),
  defaults: z
    .object({
      maxOutputTokens: z.number().int().positive().optional(),
      temperature: z.number().min(0).max(2).optional(),
      timeoutMs: z.number().int().positive().optional(),
    })
    .optional(),
  capabilities: z
    .object({
      systemMessage: z.boolean().optional(),
      structuredOutputMode: z.enum(["native", "prompted"]).optional(),
    })
    .optional(),
  metadata: z.record(z.string()).optional(),
});

const readConfigFiles = (): string[] => {
  if (!fs.existsSync(config.aiConfigDir)) {
    return [];
  }

  return fs
    .readdirSync(config.aiConfigDir)
    .filter((fileName) => fileName.endsWith(".js"))
    .sort()
    .map((fileName) => path.join(config.aiConfigDir, fileName));
};

const loadConfigModule = (filePath: string): unknown => {
  const resolvedPath = require.resolve(filePath);
  delete require.cache[resolvedPath];
  const loaded = require(resolvedPath) as unknown;

  if (
    typeof loaded === "object" &&
    loaded !== null &&
    "default" in loaded
  ) {
    return loaded.default;
  }

  return loaded;
};

export const listAiModelConfigs = (): AiModelConfig[] =>
  readConfigFiles().map((filePath) =>
    modelConfigSchema.parse(loadConfigModule(filePath)),
  );

export const getAiModelConfig = (modelId: string): AiModelConfig => {
  const configFile = listAiModelConfigs().find((item) => item.id === modelId);

  if (!configFile) {
    throw new Error(
      `AI model config not found for "${modelId}" in ${config.aiConfigDir}.`,
    );
  }

  return configFile;
};
