import crypto from "crypto";
import { FastifyRequest } from "fastify";
import { config } from "../config";

const FIVE_MINUTES_IN_SECONDS = 60 * 5;

export const verifySlackSignature = (request: FastifyRequest): boolean => {
  if (!config.slackSigningSecret) {
    return true;
  }

  const timestamp = request.headers["x-slack-request-timestamp"];
  const signature = request.headers["x-slack-signature"];
  const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody;

  if (
    typeof timestamp !== "string" ||
    typeof signature !== "string" ||
    typeof rawBody !== "string"
  ) {
    return false;
  }

  const requestAge = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(requestAge) || requestAge > FIVE_MINUTES_IN_SECONDS) {
    return false;
  }

  const base = `v0:${timestamp}:${rawBody}`;
  const digest = crypto
    .createHmac("sha256", config.slackSigningSecret)
    .update(base)
    .digest("hex");
  const expected = `v0=${digest}`;

  return crypto.timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(signature, "utf8"),
  );
};
