// src/modules/users/user.service.ts
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { ForbiddenProblem, NotFoundProblem } from "../../core/errors/problems";
import { ensureValidTimezone } from "../../core/utils/timezone-db.utils";
import { auditLogs, recurrences, users } from "../../db/schema";
import type {
  ListUsersQuery,
  UpdateUserBody,
  UpdateUserParams,
  DeleteUserParams,
  GetUserParams,
} from "./user.schemas";

type UserRow = typeof users.$inferSelect;

export class UserService {
  constructor(private app: FastifyInstance) {}

  /* ---------------------------------- GET ONE --------------------------------- */
  async getOne(params: GetUserParams, authUserId: string) {
    const result = await this.app.db.select().from(users).where(eq(users.id, params.id));
    const [user] = result as UserRow[];

    if (!user) {
      throw new NotFoundProblem("Usuário não encontrado.", `/users/${params.id}`);
    }

    if (user.id !== authUserId) {
      throw new ForbiddenProblem("Você não pode acessar este usuário.", `/users/${params.id}`);
    }

    const { passwordHash, ...publicUser } = user;
    void passwordHash;
    return publicUser;
  }

  /* ---------------------------------- LIST ----------------------------------- */
  async list(query: ListUsersQuery, authUserId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const result = await this.app.db.select().from(users).where(eq(users.id, authUserId));
    const [user] = result as UserRow[];

    if (!user) {
      throw new NotFoundProblem("Usuário não encontrado.", `/users/${authUserId}`);
    }

    if (query.name) {
      const matches = user.name.toLowerCase().includes(query.name.toLowerCase());
      if (!matches) return { data: [], page, limit };
    }

    if (query.email) {
      const matches = user.email.toLowerCase().includes(query.email.toLowerCase());
      if (!matches) return { data: [], page, limit };
    }

    const { passwordHash, ...publicUser } = user;
    void passwordHash;

    return { data: [publicUser], page, limit };
  }

  /* ---------------------------------- UPDATE ---------------------------------- */
  async update(params: UpdateUserParams, body: UpdateUserBody, authUserId: string) {
    const existingResult = await this.app.db.select().from(users).where(eq(users.id, params.id));
    const [exists] = existingResult as UserRow[];

    if (!exists) {
      throw new NotFoundProblem("Usuário não encontrado.", `/users/${params.id}`);
    }

    if (exists.id !== authUserId) {
      throw new ForbiddenProblem("Você não pode atualizar este usuário.", `/users/${params.id}`);
    }

    const payload = { ...body };
    if (payload.timezone !== undefined) {
      const normalizedTimezone = payload.timezone.trim();
      await ensureValidTimezone(this.app.db, normalizedTimezone, `/users/${params.id}`);
      payload.timezone = normalizedTimezone;
    }

    const [updated] = await this.app.db.transaction(async (txDb: typeof this.app.db) => {
      const [updatedUser] = (await txDb
        .update(users)
        .set(payload)
        .where(eq(users.id, params.id))
        .returning()) as UserRow[];

      const nextTimezone = payload.timezone;
      const timezoneChanged =
        typeof nextTimezone === "string" &&
        nextTimezone.length > 0 &&
        nextTimezone !== exists.timezone;

      if (timezoneChanged) {
        const activeRecurrencesNeedingSyncFilter = and(
          eq(recurrences.userId, params.id),
          eq(recurrences.status, "active"),
          isNull(recurrences.deletedAt),
          ne(recurrences.timezone, nextTimezone),
        );

        const linkedActiveRecurrences: Array<typeof recurrences.$inferSelect> = await txDb
          .select()
          .from(recurrences)
          .where(activeRecurrencesNeedingSyncFilter);

        if (linkedActiveRecurrences.length > 0) {
          const updatedRecurrences: Array<typeof recurrences.$inferSelect> = await txDb
            .update(recurrences)
            .set({
              timezone: nextTimezone,
              version: sql`${recurrences.version} + 1`,
              updatedAt: new Date(),
            })
            .where(activeRecurrencesNeedingSyncFilter)
            .returning();

          const beforeById = new Map(linkedActiveRecurrences.map((row) => [row.id, row] as const));
          const auditPayloads: Array<typeof auditLogs.$inferInsert> = [];

          for (const updatedRecurrence of updatedRecurrences) {
            const beforeRecurrence = beforeById.get(updatedRecurrence.id);
            if (!beforeRecurrence) {
              continue;
            }

            auditPayloads.push({
              userId: params.id,
              entityType: "recurrence",
              entityId: updatedRecurrence.id,
              action: "update",
              beforeData: {
                id: beforeRecurrence.id,
                timezone: beforeRecurrence.timezone,
                status: beforeRecurrence.status,
                nextOccurrenceDate: beforeRecurrence.nextOccurrenceDate,
                lastMaterializedDate: beforeRecurrence.lastMaterializedDate,
                version: beforeRecurrence.version,
              },
              afterData: {
                id: updatedRecurrence.id,
                timezone: updatedRecurrence.timezone,
                status: updatedRecurrence.status,
                nextOccurrenceDate: updatedRecurrence.nextOccurrenceDate,
                lastMaterializedDate: updatedRecurrence.lastMaterializedDate,
                version: updatedRecurrence.version,
              },
              metadata: {
                operation: "recurrence-timezone-sync",
                source: "user-profile-timezone-update",
                previousTimezone: exists.timezone,
                nextTimezone,
              },
            });
          }

          if (auditPayloads.length > 0) {
            await txDb.insert(auditLogs).values(auditPayloads);
          }
        }
      }

      return [updatedUser];
    });

    const { passwordHash, ...publicUser } = updated;
    void passwordHash;
    return publicUser;
  }

  /* ---------------------------------- DELETE ---------------------------------- */
  async delete(params: DeleteUserParams, authUserId: string) {
    const existingResult = await this.app.db.select().from(users).where(eq(users.id, params.id));
    const [exists] = existingResult as UserRow[];

    if (!exists) {
      throw new NotFoundProblem("Usuário não encontrado.", `/users/${params.id}`);
    }

    if (exists.id !== authUserId) {
      throw new ForbiddenProblem("Você não pode remover este usuário.", `/users/${params.id}`);
    }

    await this.app.db.delete(users).where(eq(users.id, params.id));

    return { message: "Usuário removido com sucesso." };
  }
}
