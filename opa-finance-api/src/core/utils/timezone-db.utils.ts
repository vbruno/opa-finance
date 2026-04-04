import { sql } from "drizzle-orm";
import { ValidationProblem } from "../errors/problems";
import type { DB } from "../plugins/drizzle";

export async function ensureValidTimezone(db: DB, timezone: string, path: string) {
  const normalizedTimezone = timezone.trim();

  if (!normalizedTimezone) {
    throw new ValidationProblem("Timezone inválido.", path);
  }

  const queryResult = await db.execute(
    sql`SELECT 1 AS ok FROM pg_timezone_names WHERE name = ${normalizedTimezone} LIMIT 1`,
  );
  const rows = (queryResult as { rows?: unknown[] }).rows ?? [];

  if (rows.length === 0) {
    throw new ValidationProblem("Timezone inválido.", path);
  }
}
