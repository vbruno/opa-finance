import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const booleanLikeRegex = /^(1|true|yes|y)$/i;

function parseRetryDelaysMs(value: string | undefined) {
  if (!value) {
    return [30000, 120000, 300000];
  }

  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item >= 0);

  if (parsed.length === 0) {
    return [30000, 120000, 300000];
  }

  return parsed;
}

const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(10, "JWT_SECRET deve ter no mínimo 10 caracteres."),
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(10, "REFRESH_TOKEN_SECRET deve ter no mínimo 10 caracteres."),
  PORT: z.coerce.number().default(3333),
  HOST: z.string().default("localhost"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
  RECURRENCES_JOB_ENABLED: z.string().optional(),
  RECURRENCES_JOB_TARGET_TIME: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "RECURRENCES_JOB_TARGET_TIME deve estar no formato HH:MM")
    .default("00:10"),
  RECURRENCES_JOB_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(60000),
  RECURRENCES_JOB_LOCK_TTL_MS: z.coerce.number().int().min(1000).default(900000),
  RECURRENCES_JOB_TIMEOUT_MS: z.coerce.number().int().min(1000).default(600000),
  RECURRENCES_JOB_RETRY_DELAYS_MS: z.string().optional(),
  RECURRENCES_JOB_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(500),
  RECURRENCES_JOB_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  RECURRENCES_JOB_MAX_BATCHES_PER_USER_RUN: z.coerce.number().int().min(1).max(100).default(20),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().min(1).default("OPA Finance <no-reply@opadev.com>"),
  APP_BASE_URL: z.url().default("http://localhost:5173"),
});

const rawEnv = envSchema.parse(process.env);

export const env = {
  ...rawEnv,
  RECURRENCES_JOB_ENABLED:
    rawEnv.RECURRENCES_JOB_ENABLED === undefined
      ? rawEnv.NODE_ENV === "production"
      : booleanLikeRegex.test(rawEnv.RECURRENCES_JOB_ENABLED),
  RECURRENCES_JOB_RETRY_DELAYS_MS: parseRetryDelaysMs(rawEnv.RECURRENCES_JOB_RETRY_DELAYS_MS),
};
