import { defineConfig } from "drizzle-kit";
import { env } from "./src/core/config/env";

export default defineConfig({
  out: "./src/db/migrations",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL!,
  },
});
// NOTE: Este arquivo não é usado em producao. Se alterar aqui, atualize tambem o drizzle.config.js.
