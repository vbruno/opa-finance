import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { NotFoundProblem, UnprocessableProblem } from "../../core/errors/problems";
import type { DB } from "../../core/plugins/drizzle";
import {
  compareIsoDate,
  getFirstOccurrenceOnOrAfter,
  getNextOccurrenceAfter,
  type RecurrenceSchedule,
} from "../../core/utils/recurrence-schedule.utils";
import { recurrenceOccurrenceOverrides, recurrenceOccurrences, recurrences } from "../../db/schema";
import { resolveOperationalEndDate } from "./recurrence.helpers";
import type { UpsertOccurrenceOverrideInput } from "./recurrence.schemas";
import { RecurrenceValidators } from "./recurrence.validators";

type OverrideRow = typeof recurrenceOccurrenceOverrides.$inferSelect;
type RecurrenceRow = typeof recurrences.$inferSelect;
type PersistedOccurrenceStatus = typeof recurrenceOccurrences.$inferSelect.status;

export class RecurrenceOverrideService {
  constructor(
    private app: FastifyInstance,
    private validators: RecurrenceValidators,
  ) {}

  private async getOwnedActiveRecurrence(userId: string, recurrenceId: string) {
    const [recurrence] = await this.app.db
      .select()
      .from(recurrences)
      .where(
        and(
          eq(recurrences.id, recurrenceId),
          eq(recurrences.userId, userId),
          sql`${recurrences.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (!recurrence) {
      throw new NotFoundProblem("Recorrência não encontrada.", `/recurrences/${recurrenceId}`);
    }

    if (recurrence.status !== "active") {
      throw new UnprocessableProblem(
        "Apenas recorrências ativas podem receber sobrescrita de ocorrência.",
        `/recurrences/${recurrenceId}/occurrences/override`,
      );
    }

    return recurrence;
  }

  private countOccurrencesUntil(schedule: RecurrenceSchedule, occurrenceDate: string) {
    let count = 0;
    let cursorDate = getFirstOccurrenceOnOrAfter(schedule, schedule.startDate);

    while (compareIsoDate(cursorDate, occurrenceDate) <= 0) {
      count += 1;
      if (cursorDate === occurrenceDate) return count;
      cursorDate = getNextOccurrenceAfter(schedule, cursorDate);
    }

    return count;
  }

  private async validateProjectedDate(
    recurrence: RecurrenceRow,
    occurrenceDate: string,
    actionPath: string,
  ) {
    const today = await this.validators.getNowIsoDateInTimezone(recurrence.timezone);

    if (compareIsoDate(occurrenceDate, today) < 0) {
      throw new UnprocessableProblem(
        "Não é permitido sobrescrever ocorrência passada.",
        actionPath,
      );
    }

    const schedule: RecurrenceSchedule = {
      startDate: recurrence.startDate,
      frequency: recurrence.frequency,
      dayOfWeek: recurrence.dayOfWeek,
      dayOfMonth: recurrence.dayOfMonth,
      monthOfYear: recurrence.monthOfYear,
    };

    if (compareIsoDate(occurrenceDate, recurrence.startDate) < 0) {
      throw new UnprocessableProblem(
        "A data informada é anterior ao início da recorrência.",
        actionPath,
      );
    }

    const firstOnOrAfter = getFirstOccurrenceOnOrAfter(schedule, occurrenceDate);
    if (firstOnOrAfter !== occurrenceDate) {
      throw new UnprocessableProblem(
        "A data informada não corresponde a uma ocorrência projetada da recorrência.",
        actionPath,
      );
    }

    const operationalEndDate = resolveOperationalEndDate(recurrence);
    if (operationalEndDate && compareIsoDate(occurrenceDate, operationalEndDate) > 0) {
      throw new UnprocessableProblem(
        recurrence.endType === "never"
          ? "A data informada ultrapassa o limite de 1 ano da recorrência sem fim."
          : "A data informada é posterior ao término da recorrência.",
        actionPath,
      );
    }

    if (recurrence.endType === "by_occurrences" && recurrence.endOccurrences) {
      const sequence = this.countOccurrencesUntil(schedule, occurrenceDate);
      if (sequence > recurrence.endOccurrences) {
        throw new UnprocessableProblem(
          "A data informada ultrapassa o número máximo de ocorrências.",
          actionPath,
        );
      }
    }

    const [persistedOccurrence] = await this.app.db
      .select({
        id: recurrenceOccurrences.id,
        status: recurrenceOccurrences.status,
      })
      .from(recurrenceOccurrences)
      .where(
        and(
          eq(recurrenceOccurrences.recurrenceId, recurrence.id),
          eq(recurrenceOccurrences.occurrenceDate, occurrenceDate),
        ),
      )
      .limit(1);

    if (persistedOccurrence) {
      const messagesByStatus: Record<PersistedOccurrenceStatus, string> = {
        materialized:
          "Esta data já possui uma transação materializada. Edite a transação diretamente em Transações.",
        pending_review:
          "Esta data possui uma pendência de revisão. Use Confirmar ou Ignorar na timeline da recorrência.",
        skipped:
          "Esta data foi ignorada e não pode receber sobrescrita. Para ajustar valores futuros, use 'Esta e próximas' a partir de uma data futura.",
        failed:
          "Esta data registrou falha de materialização e não pode receber sobrescrita. Para ajustar valores futuros, use 'Esta e próximas' a partir de uma data futura.",
      };

      throw new UnprocessableProblem(
        messagesByStatus[persistedOccurrence.status as PersistedOccurrenceStatus],
        actionPath,
      );
    }
  }

  async upsert(userId: string, recurrenceId: string, input: UpsertOccurrenceOverrideInput) {
    const actionPath = `/recurrences/${recurrenceId}/occurrences/override`;
    const recurrence = await this.getOwnedActiveRecurrence(userId, recurrenceId);
    await this.validateProjectedDate(recurrence, input.occurrenceDate, actionPath);

    const insertPayload = {
      recurrenceId,
      userId,
      occurrenceDate: input.occurrenceDate,
      amount: input.amount !== undefined ? input.amount.toString() : null,
      description: input.description ?? null,
      notes: input.notes ?? null,
      updatedAt: new Date(),
    } satisfies typeof recurrenceOccurrenceOverrides.$inferInsert;

    const updatePayload: Partial<typeof recurrenceOccurrenceOverrides.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.amount !== undefined) updatePayload.amount = input.amount.toString();
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.notes !== undefined) updatePayload.notes = input.notes;

    const [saved] = await this.app.db
      .insert(recurrenceOccurrenceOverrides)
      .values(insertPayload)
      .onConflictDoUpdate({
        target: [
          recurrenceOccurrenceOverrides.recurrenceId,
          recurrenceOccurrenceOverrides.occurrenceDate,
        ],
        set: updatePayload,
      })
      .returning();

    return this.serialize(saved);
  }

  async delete(userId: string, recurrenceId: string, occurrenceDate: string) {
    await this.getOwnedActiveRecurrence(userId, recurrenceId);
    const deleted = await this.deleteByDate(recurrenceId, occurrenceDate);

    if (deleted === 0) {
      throw new NotFoundProblem(
        "Sobrescrita da ocorrência não encontrada.",
        `/recurrences/${recurrenceId}/occurrences/override/${occurrenceDate}`,
      );
    }
  }

  async findByDate(recurrenceId: string, occurrenceDate: string, tx: DB = this.app.db) {
    const [override] = await tx
      .select()
      .from(recurrenceOccurrenceOverrides)
      .where(
        and(
          eq(recurrenceOccurrenceOverrides.recurrenceId, recurrenceId),
          eq(recurrenceOccurrenceOverrides.occurrenceDate, occurrenceDate),
        ),
      )
      .limit(1);

    return override ?? null;
  }

  async findByDateRange(
    recurrenceId: string,
    startDate: string,
    endDate: string,
    tx: DB = this.app.db,
  ) {
    return tx
      .select()
      .from(recurrenceOccurrenceOverrides)
      .where(
        and(
          eq(recurrenceOccurrenceOverrides.recurrenceId, recurrenceId),
          gte(recurrenceOccurrenceOverrides.occurrenceDate, startDate),
          lte(recurrenceOccurrenceOverrides.occurrenceDate, endDate),
        ),
      );
  }

  async deleteByDate(recurrenceId: string, occurrenceDate: string, tx: DB = this.app.db) {
    const deleted = await tx
      .delete(recurrenceOccurrenceOverrides)
      .where(
        and(
          eq(recurrenceOccurrenceOverrides.recurrenceId, recurrenceId),
          eq(recurrenceOccurrenceOverrides.occurrenceDate, occurrenceDate),
        ),
      )
      .returning({ id: recurrenceOccurrenceOverrides.id });

    return deleted.length;
  }

  serialize(override: OverrideRow) {
    return {
      ...override,
      amount: override.amount === null ? null : Number(override.amount),
    };
  }
}
