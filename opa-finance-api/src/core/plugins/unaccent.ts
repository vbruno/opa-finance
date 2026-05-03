import { sql } from "drizzle-orm";
import fp from "fastify-plugin";

const UNACCENT_CHECK_TIMEOUT_MS = 2_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("UNACCENT_CHECK_TIMEOUT"));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export const unaccentPlugin = fp(async function (app) {
  try {
    const result = await withTimeout(
      app.db.execute(sql`select 1 from pg_extension where extname = 'unaccent'`),
      UNACCENT_CHECK_TIMEOUT_MS,
    );
    const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
    app.decorate("unaccentEnabled", rows.length > 0);
  } catch {
    app.decorate("unaccentEnabled", false);
  }
});
