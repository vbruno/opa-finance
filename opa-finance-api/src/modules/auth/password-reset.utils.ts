import { createHash } from "node:crypto";

export const RESET_TOKEN_TTL_MINUTES = 15;

export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function buildResetLink(baseUrl: string, rawToken: string): string {
  return `${baseUrl}/reset-password?token=${rawToken}`;
}
