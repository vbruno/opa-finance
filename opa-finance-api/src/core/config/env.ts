import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

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
});

export const env = envSchema.parse(process.env);
