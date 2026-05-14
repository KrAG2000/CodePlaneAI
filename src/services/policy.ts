import { PolicyDecision } from "../types";

export const evaluatePolicy = (protectedPaths: string[]): PolicyDecision => {
  const reasons: string[] = [];

  reasons.push("Text trigger is allowed for planning in MVP mode.");

  if (protectedPaths.length > 0) {
    reasons.push("Changed files will be checked against protected path rules before PR actions.");
  }

  return {
    status: "allowed",
    reasons,
    protectedPaths,
    allowedToFinalize: true,
  };
};
