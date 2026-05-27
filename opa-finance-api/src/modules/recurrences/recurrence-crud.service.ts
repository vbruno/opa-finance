import { and, desc, eq, getTableColumns, ilike, inArray, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  ConflictProblem,
  ForbiddenProblem,
  NotFoundProblem,
  UnprocessableProblem,
  ValidationProblem,
} from "../../core/errors/problems";
import { ValidationProblem as VP } from "../../core/errors/problems";
import type { DB } from "../../core/plugins/drizzle";
import { recurrenceOccurrences, recurrences, subcategories } from "../../db/schema";
import { AuditService } from "../audit/audit.service";
import { RecurrenceAudit } from "./recurrence.audit";
import {
  CONSUMED_OCCURRENCE_STATUSES,
  getFirstOccurrenceForRecurrence,
  serializeRecurrence,
} from "./recurrence.helpers";
import type { CreateRecurrenceInput, ListRecurrencesQuery } from "./recurrence.schemas";
import { RecurrenceValidators } from "./recurrence.validators";

export class RecurrenceCrudService {
  constructor(
    private app: FastifyInstance,
    private auditService: AuditService,
    private recurrenceAudit: RecurrenceAudit,
    private validators: RecurrenceValidators,
  ) {}

  private async getOpenPendingReviewOccurrences(userId: string, recurrenceId: string) {
    return this.app.db
      .select({
        id: recurrenceOccurrences.id,
        occurrenceDate: recurrenceOccurrences.occurrenceDate,
      })
      .from(recurrenceOccurrences)
      .innerJoin(recurrences, eq(recurrenceOccurrences.recurrenceId, recurrences.id))
      .where(
        and(
          eq(recurrenceOccurrences.recurrenceId, recurrenceId),
          eq(recurrenceOccurrences.status, "pending_review"),
          eq(recurrences.userId, userId),
          sql`${recurrences.deletedAt} IS NULL`,
        ),
      );
  }

  private throwPendingReviewBlocker(
    action: "finalizar" | "excluir",
    pendingOccurrences: Array<{ id: string; occurrenceDate: string }>,
    recurrenceId: string,
  ): never {
    const pendingIds = pendingOccurrences.map((occurrence) => occurrence.id).join(", ");
    throw new UnprocessableProblem(
      `Esta recorrência possui pendências em aberto (${pendingIds}). Resolva-as antes de ${action}.`,
      `/recurrences/${recurrenceId}`,
    );
  }

  async create(userId: string, data: CreateRecurrenceInput) {
    await this.validators.validatePayloadOwnership(userId, data);
    const timezone = await this.validators.getUserTimezone(userId);

    let nextOccurrenceDate: string;
    try {
      nextOccurrenceDate = getFirstOccurrenceForRecurrence({
        startDate: data.startDate,
        frequency: data.frequency,
        dayOfWeek: data.dayOfWeek ?? null,
        dayOfMonth: data.dayOfMonth ?? null,
        monthOfYear: data.monthOfYear ?? null,
      });
    } catch {
      throw new ValidationProblem(
        "Regra de recorrência inválida para cálculo de agenda.",
        "/recurrences",
      );
    }

    const [created] = await this.app.db.transaction(async (tx: DB) => {
      const [inserted] = await tx
        .insert(recurrences)
        .values({
          userId,
          originType: data.originType,
          status: "active",
          postingMode: data.postingMode,
          timezone,
          frequency: data.frequency,
          startDate: data.startDate,
          dayOfWeek: data.dayOfWeek ?? null,
          dayOfMonth: data.dayOfMonth ?? null,
          monthOfYear: data.monthOfYear ?? null,
          endType: data.endType,
          endOccurrences: data.endOccurrences ?? null,
          endDate: data.endDate ?? null,
          accountId: data.accountId ?? null,
          categoryId: data.categoryId ?? null,
          subcategoryId: data.subcategoryId ?? null,
          fromAccountId: data.fromAccountId ?? null,
          toAccountId: data.toAccountId ?? null,
          amount: data.amount.toString(),
          description: data.description ?? null,
          notes: data.notes ?? null,
          nextOccurrenceDate,
        })
        .returning();

      await this.auditService.log(
        {
          userId,
          entityType: "recurrence",
          entityId: inserted.id,
          action: "create",
          beforeData: null,
          afterData: this.recurrenceAudit.toAuditData(inserted),
          metadata: {
            operation: "recurrence-create",
          },
        },
        tx,
      );

      return [inserted];
    });

    return {
      ...serializeRecurrence(created),
      hasConsumedOccurrences: false,
    };
  }

  async list(userId: string, query: ListRecurrencesQuery) {
    if (query.accountId) {
      await this.validators.ensureAccountOwnership(userId, query.accountId, "/recurrences");
    }

    const filters = [eq(recurrences.userId, userId), sql`${recurrences.deletedAt} IS NULL`];

    if (query.originType) {
      filters.push(eq(recurrences.originType, query.originType));
    }
    if (query.status) {
      filters.push(eq(recurrences.status, query.status));
    }
    if (query.frequency) {
      filters.push(eq(recurrences.frequency, query.frequency));
    }
    if (query.postingMode) {
      filters.push(eq(recurrences.postingMode, query.postingMode));
    }
    if (query.accountId) {
      filters.push(
        or(
          eq(recurrences.accountId, query.accountId),
          eq(recurrences.fromAccountId, query.accountId),
          eq(recurrences.toAccountId, query.accountId),
        )!,
      );
    }
    if (query.q) {
      filters.push(
        or(
          ilike(recurrences.description, `%${query.q}%`),
          ilike(recurrences.notes, `%${query.q}%`),
        )!,
      );
    }

    const whereClause = and(...filters);
    const offset = (query.page - 1) * query.limit;
    const pendingCounts = this.app.db
      .select({
        recurrenceId: recurrenceOccurrences.recurrenceId,
        pendingReviewCount: sql<number>`count(*)::int`.as("pending_review_count"),
      })
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.status, "pending_review"))
      .groupBy(recurrenceOccurrences.recurrenceId)
      .as("pending_counts");

    const consumedCounts = this.app.db
      .select({
        recurrenceId: recurrenceOccurrences.recurrenceId,
        consumedOccurrenceCount: sql<number>`count(*)::int`.as("consumed_occurrence_count"),
      })
      .from(recurrenceOccurrences)
      .where(inArray(recurrenceOccurrences.status, CONSUMED_OCCURRENCE_STATUSES))
      .groupBy(recurrenceOccurrences.recurrenceId)
      .as("consumed_counts");

    const [totalResult] = await this.app.db
      .select({ total: sql<number>`count(*)::int` })
      .from(recurrences)
      .where(whereClause);

    const rows: Array<
      typeof recurrences.$inferSelect & {
        pendingReviewCount: number;
        consumedOccurrenceCount: number;
        subcategoryName: string | null;
      }
    > = await this.app.db
      .select({
        ...getTableColumns(recurrences),
        pendingReviewCount: sql<number>`coalesce(${pendingCounts.pendingReviewCount}, 0)::int`,
        consumedOccurrenceCount: sql<number>`coalesce(${consumedCounts.consumedOccurrenceCount}, 0)::int`,
        subcategoryName: subcategories.name,
      })
      .from(recurrences)
      .leftJoin(pendingCounts, eq(pendingCounts.recurrenceId, recurrences.id))
      .leftJoin(consumedCounts, eq(consumedCounts.recurrenceId, recurrences.id))
      .leftJoin(subcategories, eq(subcategories.id, recurrences.subcategoryId))
      .where(whereClause)
      .orderBy(desc(recurrences.createdAt))
      .limit(query.limit)
      .offset(offset);

    return {
      data: rows.map((row) => ({
        ...serializeRecurrence(row),
        hasConsumedOccurrences: row.consumedOccurrenceCount > 0,
        pendingReviewCount: row.pendingReviewCount,
        subcategoryName: row.subcategoryName ?? null,
      })),
      page: query.page,
      limit: query.limit,
      total: totalResult?.total ?? 0,
    };
  }

  async getOne(userId: string, recurrenceId: string) {
    const [row] = await this.app.db
      .select({
        ...getTableColumns(recurrences),
        subcategoryName: subcategories.name,
      })
      .from(recurrences)
      .leftJoin(subcategories, eq(subcategories.id, recurrences.subcategoryId))
      .where(and(eq(recurrences.id, recurrenceId), sql`${recurrences.deletedAt} IS NULL`))
      .limit(1);

    if (!row) {
      throw new NotFoundProblem("Recorrência não encontrada.", `/recurrences/${recurrenceId}`);
    }
    if (row.userId !== userId) {
      throw new ForbiddenProblem("Acesso negado à recorrência.", `/recurrences/${recurrenceId}`);
    }

    const hasConsumedOccurrences = await this.validators.hasConsumedOccurrences(recurrenceId);

    return {
      ...serializeRecurrence(row),
      hasConsumedOccurrences,
      subcategoryName: row.subcategoryName ?? null,
    };
  }

  async finalize(userId: string, recurrenceId: string) {
    const existing = await this.getOne(userId, recurrenceId);

    if (existing.status === "finalized") {
      return existing;
    }

    const pendingOccurrences = await this.getOpenPendingReviewOccurrences(userId, recurrenceId);
    if (pendingOccurrences.length > 0) {
      this.throwPendingReviewBlocker("finalizar", pendingOccurrences, recurrenceId);
    }

    const [updated] = await this.app.db.transaction(async (tx: DB) => {
      const [updatedRow] = await tx
        .update(recurrences)
        .set({
          status: "finalized",
          finalizedAt: new Date(),
          updatedAt: new Date(),
          version: existing.version + 1,
        })
        .where(
          and(
            eq(recurrences.id, recurrenceId),
            eq(recurrences.userId, userId),
            eq(recurrences.version, existing.version),
            eq(recurrences.status, "active"),
            sql`${recurrences.deletedAt} IS NULL`,
          ),
        )
        .returning();

      if (!updatedRow) {
        throw new ConflictProblem(
          "A recorrência foi alterada por outra sessão. Recarregue e tente novamente.",
          `/recurrences/${recurrenceId}`,
        );
      }

      await this.auditService.log(
        {
          userId,
          entityType: "recurrence",
          entityId: updatedRow.id,
          action: "update",
          beforeData: this.recurrenceAudit.toAuditData(existing),
          afterData: this.recurrenceAudit.toAuditData(updatedRow),
          metadata: {
            operation: "recurrence-finalize",
          },
        },
        tx,
      );

      return [updatedRow];
    });

    return {
      ...serializeRecurrence(updated),
      hasConsumedOccurrences: existing.hasConsumedOccurrences,
    };
  }

  async remove(userId: string, recurrenceId: string) {
    const existing = await this.getOne(userId, recurrenceId);

    const pendingOccurrences = await this.getOpenPendingReviewOccurrences(userId, recurrenceId);
    if (pendingOccurrences.length > 0) {
      this.throwPendingReviewBlocker("excluir", pendingOccurrences, recurrenceId);
    }

    if (existing.status === "active") {
      throw new VP(
        "Recorrência ativa não pode ser excluída. Finalize antes de excluir.",
        `/recurrences/${recurrenceId}`,
      );
    }

    await this.app.db.transaction(async (tx: DB) => {
      const [deletedRow] = await tx
        .update(recurrences)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: existing.version + 1,
        })
        .where(
          and(
            eq(recurrences.id, recurrenceId),
            eq(recurrences.userId, userId),
            eq(recurrences.version, existing.version),
            eq(recurrences.status, "finalized"),
            sql`${recurrences.deletedAt} IS NULL`,
          ),
        )
        .returning();

      if (!deletedRow) {
        throw new ConflictProblem(
          "A recorrência foi alterada por outra sessão. Recarregue e tente novamente.",
          `/recurrences/${recurrenceId}`,
        );
      }

      await this.auditService.log(
        {
          userId,
          entityType: "recurrence",
          entityId: recurrenceId,
          action: "delete",
          beforeData: this.recurrenceAudit.toAuditData(existing),
          afterData: this.recurrenceAudit.toAuditData(deletedRow),
          metadata: {
            operation: "recurrence-delete",
          },
        },
        tx,
      );
    });

    return { message: "Recorrência removida com sucesso." };
  }
}
