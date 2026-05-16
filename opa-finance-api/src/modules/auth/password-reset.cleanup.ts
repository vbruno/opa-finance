import { sql } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";

import type { DB } from "../../core/plugins/drizzle";
import { passwordResetTokens } from "../../db/schema";

const RETENTION_DAYS = 7;

export async function cleanupExpiredPasswordResetTokens(
  db: DB,
  logger: FastifyBaseLogger,
): Promise<{ removed: number }> {
  const result = await db
    .delete(passwordResetTokens)
    .where(
      sql`${passwordResetTokens.expiresAt} < now() - interval '${sql.raw(String(RETENTION_DAYS))} days'`,
    )
    .returning({ id: passwordResetTokens.id });

  const removed = result.length;
  if (removed > 0) {
    logger.info(
      { event: "auth.password_reset_tokens.cleanup", removed, retentionDays: RETENTION_DAYS },
      "Tokens expirados de reset de senha removidos.",
    );
  }

  return { removed };
}
