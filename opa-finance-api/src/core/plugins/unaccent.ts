import { sql } from "drizzle-orm";
import fp from "fastify-plugin";

export const unaccentPlugin = fp(async function (app) {
  try {
    const result = await app.db.execute(sql`select 1 from pg_extension where extname = 'unaccent'`);
    const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
    app.decorate("unaccentEnabled", rows.length > 0);
  } catch {
    app.decorate("unaccentEnabled", false);
  }
});
