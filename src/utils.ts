import crypto from "crypto";

export const nowIso = (): string => new Date().toISOString();

export const createExecutionId = (): string =>
  `exec_${crypto.randomBytes(6).toString("hex")}`;

export const slugify = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export const dedupe = (values: string[]): string[] => [...new Set(values)];
