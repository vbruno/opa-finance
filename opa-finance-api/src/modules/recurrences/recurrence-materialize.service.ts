import { randomUUID } from "crypto";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { ValidationProblem } from "../../core/errors/problems";
import type { DB } from "../../core/plugins/drizzle";
import {
  compareIsoDate,
  getFirstOccurrenceOnOrAfter,
  getNextOccurrenceAfter,
  type RecurrenceSchedule,
} from "../../core/utils/recurrence-schedule.utils";
import {
  categories,
  recurrenceOccurrenceOverrides,
  recurrenceOccurrences,
  recurrences,
  transactions,
} from "../../db/schema";
import { RecurrenceAudit } from "./recurrence.audit";
import {
  CONSUMED_OCCURRENCE_STATUSES,
  minIsoDate,
  resolveOperationalEndDate,
} from "./recurrence.helpers";
import type { MaterializeRecurrencesInput } from "./recurrence.schemas";
import { RecurrenceValidators } from "./recurrence.validators";

type RecurrenceOccurrenceRow = typeof recurrenceOccurrences.$inferSelect;
type RecurrenceRow = typeof recurrences.$inferSelect;
type RecurrenceOverrideRow = typeof recurrenceOccurrenceOverrides.$inferSelect;

export class RecurrenceMaterializeService {
  private readonly defaultMaterializationBatchSize = 200;
  private readonly maxMaterializationIterations = 500;

  constructor(
    private app: FastifyInstance,
    private recurrenceAudit: RecurrenceAudit,
    private validators: RecurrenceValidators,
  ) {}

  private buildEffectiveRecurrence(
    recurrence: RecurrenceRow,
    override: RecurrenceOverrideRow | null,
  ): RecurrenceRow {
    if (!override) return recurrence;

    return {
      ...recurrence,
      amount: override.amount ?? recurrence.amount,
      description: override.description ?? recurrence.description,
      notes: override.notes ?? recurrence.notes,
    };
  }

  private buildReviewPayload(recurrence: RecurrenceRow, occurrenceDate: string) {
    return {
      occurrenceDate,
      originalScheduledDate: occurrenceDate,
      originType: recurrence.originType,
      amount: Number(recurrence.amount),
      description: recurrence.description,
      notes: recurrence.notes,
      accountId: recurrence.accountId,
      categoryId: recurrence.categoryId,
      subcategoryId: recurrence.subcategoryId,
      fromAccountId: recurrence.fromAccountId,
      toAccountId: recurrence.toAccountId,
    };
  }

  private async materializeTransactionOccurrence(
    tx: DB,
    recurrence: RecurrenceRow,
    occurrenceDate: string,
  ) {
    if (!recurrence.accountId || !recurrence.categoryId) {
      throw new ValidationProblem(
        "Recorrência de transação inválida: conta e categoria são obrigatórias.",
        "/recurrences/materialize",
      );
    }

    const [category] = await tx
      .select({ type: categories.type })
      .from(categories)
      .where(eq(categories.id, recurrence.categoryId))
      .limit(1);

    if (!category) {
      throw new ValidationProblem(
        "Categoria da recorrência não encontrada para materialização.",
        "/recurrences/materialize",
      );
    }

    const [createdTx] = await tx
      .insert(transactions)
      .values({
        userId: recurrence.userId,
        accountId: recurrence.accountId,
        categoryId: recurrence.categoryId,
        subcategoryId: recurrence.subcategoryId,
        type: category.type,
        amount: recurrence.amount,
        date: occurrenceDate,
        description: recurrence.description,
        notes: recurrence.notes,
      })
      .returning({ id: transactions.id });

    return { transactionId: createdTx.id, transferId: null as string | null };
  }

  private async materializeTransferOccurrence(
    tx: DB,
    recurrence: RecurrenceRow,
    occurrenceDate: string,
    transferCategoryId: string,
  ) {
    if (!recurrence.fromAccountId || !recurrence.toAccountId) {
      throw new ValidationProblem(
        "Recorrência de transferência inválida: contas de origem e destino são obrigatórias.",
        "/recurrences/materialize",
      );
    }

    if (recurrence.fromAccountId === recurrence.toAccountId) {
      throw new ValidationProblem(
        "Recorrência de transferência inválida: origem e destino não podem ser iguais.",
        "/recurrences/materialize",
      );
    }

    const transferId = randomUUID();

    const insertedTransactions = await tx
      .insert(transactions)
      .values([
        {
          userId: recurrence.userId,
          accountId: recurrence.fromAccountId,
          categoryId: transferCategoryId,
          type: "expense",
          amount: recurrence.amount,
          date: occurrenceDate,
          description: recurrence.description,
          notes: recurrence.notes,
          transferId,
        },
        {
          userId: recurrence.userId,
          accountId: recurrence.toAccountId,
          categoryId: transferCategoryId,
          type: "income",
          amount: recurrence.amount,
          date: occurrenceDate,
          description: recurrence.description,
          notes: recurrence.notes,
          transferId,
        },
      ])
      .returning({ id: transactions.id });

    if (insertedTransactions.length !== 2) {
      throw new ValidationProblem(
        "Falha ao materializar transferência recorrente de forma atômica.",
        "/recurrences/materialize",
      );
    }

    return { transactionId: null as string | null, transferId };
  }

  async materialize(userId: string, input: MaterializeRecurrencesInput) {
    const todayByTimezone = new Map<string, string>();
    let transferCategoryId: string | null = null;
    const batchSize = input.maxRecurrences ?? this.defaultMaterializationBatchSize;

    const [activeCountResult] = await this.app.db
      .select({ total: sql<number>`count(*)::int` })
      .from(recurrences)
      .where(
        and(
          eq(recurrences.userId, userId),
          eq(recurrences.status, "active"),
          sql`${recurrences.deletedAt} IS NULL`,
        ),
      );
    const totalActive = activeCountResult?.total ?? 0;

    const activeRecurrences = await this.app.db
      .select()
      .from(recurrences)
      .where(
        and(
          eq(recurrences.userId, userId),
          eq(recurrences.status, "active"),
          sql`${recurrences.deletedAt} IS NULL`,
          input.recurrenceId ? eq(recurrences.id, input.recurrenceId) : undefined,
        ),
      )
      .orderBy(asc(recurrences.createdAt))
      .limit(batchSize);

    let createdOccurrences = 0;
    let skippedOccurrences = 0;
    let createdTransactions = 0;
    let createdTransfers = 0;
    let finalizedRecurrences = 0;
    let failedRecurrences = 0;

    for (const recurrence of activeRecurrences) {
      try {
        await this.validators.validateRecurrenceLinkedOwnership(
          userId,
          recurrence,
          "/recurrences/materialize",
        );
      } catch (error) {
        this.app.log.warn(
          {
            recurrenceId: recurrence.id,
            userId: recurrence.userId,
            originType: recurrence.originType,
            error,
          },
          "Skipping recurrence materialization due to ownership/consistency validation failure",
        );
        failedRecurrences += 1;
        continue;
      }

      const schedule: RecurrenceSchedule = {
        startDate: recurrence.startDate,
        frequency: recurrence.frequency,
        dayOfWeek: recurrence.dayOfWeek,
        dayOfMonth: recurrence.dayOfMonth,
        monthOfYear: recurrence.monthOfYear,
      };
      let untilDate = input.untilDate;
      if (!untilDate) {
        const cachedToday = todayByTimezone.get(recurrence.timezone);
        if (cachedToday) {
          untilDate = cachedToday;
        } else {
          untilDate = await this.validators.getNowIsoDateInTimezone(recurrence.timezone);
          todayByTimezone.set(recurrence.timezone, untilDate);
        }
      }
      const operationalEndDate = resolveOperationalEndDate(recurrence);
      const effectiveUntilDate = minIsoDate(untilDate, operationalEndDate) ?? untilDate;
      let cursorDate = recurrence.nextOccurrenceDate ?? recurrence.startDate;

      let localCreated = 0;
      let localSkipped = 0;
      let localTransactions = 0;
      let localTransfers = 0;
      let localFirstProcessedDate: string | null = null;
      let localLastMaterializedDate: string | null = null;
      let shouldFinalize = false;
      let iterations = 0;
      let updatedRecurrenceSnapshot: typeof recurrences.$inferSelect | null = null;

      try {
        if (compareIsoDate(cursorDate, recurrence.startDate) < 0) {
          cursorDate = recurrence.startDate;
        }
        cursorDate = getFirstOccurrenceOnOrAfter(schedule, cursorDate);

        let consumedCount = 0;
        let openPendingReviewCount = 0;
        const needsConsumedCount =
          recurrence.endType === "by_occurrences" && !!recurrence.endOccurrences;
        const needsPendingReviewCount =
          recurrence.postingMode === "review_required" &&
          (needsConsumedCount ||
            recurrence.endType === "until_date" ||
            recurrence.endType === "never");
        if (needsConsumedCount || needsPendingReviewCount) {
          const countRows = await this.app.db
            .select({
              status: recurrenceOccurrences.status,
              total: sql<number>`count(*)::int`,
            })
            .from(recurrenceOccurrences)
            .where(
              and(
                eq(recurrenceOccurrences.recurrenceId, recurrence.id),
                inArray(recurrenceOccurrences.status, CONSUMED_OCCURRENCE_STATUSES),
              ),
            )
            .groupBy(recurrenceOccurrences.status);
          for (const row of countRows) {
            const total = row.total ?? 0;
            if (needsConsumedCount) consumedCount += total;
            if (row.status === "pending_review") {
              openPendingReviewCount = total;
            }
          }
        }

        const overrideRows: RecurrenceOverrideRow[] = await this.app.db
          .select()
          .from(recurrenceOccurrenceOverrides)
          .where(
            and(
              eq(recurrenceOccurrenceOverrides.recurrenceId, recurrence.id),
              gte(recurrenceOccurrenceOverrides.occurrenceDate, cursorDate),
              lte(recurrenceOccurrenceOverrides.occurrenceDate, effectiveUntilDate),
            ),
          );
        const overrideByDate = new Map(
          overrideRows.map((override) => [override.occurrenceDate, override]),
        );

        while (compareIsoDate(cursorDate, effectiveUntilDate) <= 0) {
          iterations += 1;
          if (!localFirstProcessedDate) {
            localFirstProcessedDate = cursorDate;
          }
          if (iterations > this.maxMaterializationIterations) {
            throw new ValidationProblem(
              "Limite de materialização por recorrência excedido nesta execução.",
              "/recurrences/materialize",
            );
          }

          if (recurrence.endType === "until_date" && recurrence.endDate) {
            if (compareIsoDate(cursorDate, recurrence.endDate) > 0) {
              if (openPendingReviewCount === 0) {
                shouldFinalize = true;
              }
              break;
            }
          }

          if (recurrence.endType === "by_occurrences" && recurrence.endOccurrences) {
            if (consumedCount >= recurrence.endOccurrences) {
              if (openPendingReviewCount === 0) {
                shouldFinalize = true;
              }
              break;
            }
          }

          const occurrenceOutcome = await this.app.db.transaction(async (tx: DB) => {
            const override = overrideByDate.get(cursorDate) ?? null;
            const effectiveRecurrence = this.buildEffectiveRecurrence(recurrence, override ?? null);

            const [occurrence] = await tx
              .insert(recurrenceOccurrences)
              .values({
                recurrenceId: recurrence.id,
                originType: recurrence.originType,
                occurrenceDate: cursorDate,
                status:
                  recurrence.postingMode === "review_required" ? "pending_review" : "materialized",
                metadata: {
                  source: "recurrence-materialization",
                  generatedAt: new Date().toISOString(),
                },
                reviewPayload:
                  recurrence.postingMode === "review_required"
                    ? this.buildReviewPayload(effectiveRecurrence, cursorDate)
                    : null,
              })
              .onConflictDoNothing({
                target: [
                  recurrenceOccurrences.recurrenceId,
                  recurrenceOccurrences.occurrenceDate,
                  recurrenceOccurrences.originType,
                ],
              })
              .returning();

            if (!occurrence) {
              return {
                inserted: false,
                occurrence: null as RecurrenceOccurrenceRow | null,
                transactionId: null as string | null,
                transferId: null as string | null,
                status: null as "materialized" | "pending_review" | null,
              };
            }

            if (recurrence.postingMode === "review_required") {
              if (override) {
                await tx
                  .delete(recurrenceOccurrenceOverrides)
                  .where(eq(recurrenceOccurrenceOverrides.id, override.id));
              }

              return {
                inserted: true,
                occurrence,
                transactionId: null as string | null,
                transferId: null as string | null,
                status: "pending_review" as const,
              };
            }

            if (recurrence.originType === "transaction") {
              const transactionResult = await this.materializeTransactionOccurrence(
                tx,
                effectiveRecurrence,
                cursorDate,
              );

              const [updatedOccurrence] = await tx
                .update(recurrenceOccurrences)
                .set({
                  transactionId: transactionResult.transactionId,
                })
                .where(eq(recurrenceOccurrences.id, occurrence.id))
                .returning();

              if (override) {
                await tx
                  .delete(recurrenceOccurrenceOverrides)
                  .where(eq(recurrenceOccurrenceOverrides.id, override.id));
              }

              return {
                inserted: true,
                occurrence: updatedOccurrence ?? occurrence,
                status: "materialized" as const,
                ...transactionResult,
              };
            }

            if (!transferCategoryId) {
              transferCategoryId = await this.validators.getTransferCategoryId();
            }
            const ensuredTransferCategoryId = transferCategoryId as string;

            const transferResult = await this.materializeTransferOccurrence(
              tx,
              effectiveRecurrence,
              cursorDate,
              ensuredTransferCategoryId,
            );

            const [updatedOccurrence] = await tx
              .update(recurrenceOccurrences)
              .set({
                transferId: transferResult.transferId,
              })
              .where(eq(recurrenceOccurrences.id, occurrence.id))
              .returning();

            if (override) {
              await tx
                .delete(recurrenceOccurrenceOverrides)
                .where(eq(recurrenceOccurrenceOverrides.id, override.id));
            }

            return {
              inserted: true,
              occurrence: updatedOccurrence ?? occurrence,
              status: "materialized" as const,
              ...transferResult,
            };
          });

          if (occurrenceOutcome.inserted) {
            localCreated += 1;
            if (occurrenceOutcome.status === "materialized") {
              localLastMaterializedDate = cursorDate;
            }
            if (occurrenceOutcome.transactionId) localTransactions += 1;
            if (occurrenceOutcome.transferId) localTransfers += 1;
            if (recurrence.endType === "by_occurrences" && recurrence.endOccurrences) {
              consumedCount += 1;
            }
            if (occurrenceOutcome.status === "pending_review") {
              openPendingReviewCount += 1;
            }
            if (
              recurrence.endType === "by_occurrences" &&
              recurrence.endOccurrences &&
              consumedCount >= recurrence.endOccurrences &&
              openPendingReviewCount === 0
            ) {
              shouldFinalize = true;
            }
          } else {
            localSkipped += 1;
          }

          if (
            occurrenceOutcome.inserted &&
            occurrenceOutcome.status === "pending_review" &&
            occurrenceOutcome.occurrence
          ) {
            await this.recurrenceAudit.logBestEffort(
              {
                userId: recurrence.userId,
                entityType: "recurrence_occurrence",
                entityId: occurrenceOutcome.occurrence.id,
                action: "materialize_pending",
                beforeData: null,
                afterData: this.recurrenceAudit.toOccurrenceAuditData(
                  occurrenceOutcome.occurrence,
                  occurrenceOutcome.occurrence.reviewPayload as Record<string, unknown> | null,
                ),
                metadata: {
                  operation: "recurrence-occurrence-materialize-pending",
                  recurrenceId: recurrence.id,
                  occurrenceDate: cursorDate,
                },
              },
              {
                recurrenceId: recurrence.id,
                userId: recurrence.userId,
                occurrenceId: occurrenceOutcome.occurrence.id,
                occurrenceDate: cursorDate,
                operation: "recurrence-occurrence-materialize-pending",
              },
            );
          }

          cursorDate = getNextOccurrenceAfter(schedule, cursorDate);
        }

        if (
          recurrence.endType === "never" &&
          operationalEndDate &&
          compareIsoDate(cursorDate, operationalEndDate) > 0 &&
          openPendingReviewCount === 0
        ) {
          shouldFinalize = true;
        }
      } catch (error) {
        this.app.log.error(
          {
            recurrenceId: recurrence.id,
            userId: recurrence.userId,
            originType: recurrence.originType,
            cursorDate,
            error,
          },
          "Recurrence materialization failed",
        );

        // MVP: failed is terminal. Não reprocessar automaticamente nem tentar reabrir aqui.
        failedRecurrences += 1;
        continue;
      }

      let currentVersion = recurrence.version;
      let updateApplied = false;
      let retries = 0;

      while (retries < 3) {
        const [current] = await this.app.db
          .select({
            id: recurrences.id,
            status: recurrences.status,
            version: recurrences.version,
            nextOccurrenceDate: recurrences.nextOccurrenceDate,
            lastMaterializedDate: recurrences.lastMaterializedDate,
          })
          .from(recurrences)
          .where(
            and(
              eq(recurrences.id, recurrence.id),
              eq(recurrences.userId, userId),
              sql`${recurrences.deletedAt} IS NULL`,
            ),
          )
          .limit(1);

        if (!current || current.status !== "active") {
          break;
        }

        currentVersion = current.version;

        const mergedLastMaterializedDate =
          localLastMaterializedDate &&
          (!current.lastMaterializedDate ||
            compareIsoDate(localLastMaterializedDate, current.lastMaterializedDate) > 0)
            ? localLastMaterializedDate
            : current.lastMaterializedDate;

        const mergedNextOccurrenceDate = shouldFinalize
          ? null
          : current.nextOccurrenceDate && compareIsoDate(current.nextOccurrenceDate, cursorDate) > 0
            ? current.nextOccurrenceDate
            : cursorDate;

        const updatePayload: Partial<typeof recurrences.$inferInsert> = {
          nextOccurrenceDate: mergedNextOccurrenceDate,
          updatedAt: new Date(),
          version: currentVersion + 1,
        };

        if (mergedLastMaterializedDate) {
          updatePayload.lastMaterializedDate = mergedLastMaterializedDate;
          updatePayload.lastMaterializedAt = new Date();
        }

        if (shouldFinalize) {
          updatePayload.status = "finalized";
          updatePayload.finalizedAt = new Date();
        }

        const [updatedRecurrence] = await this.app.db
          .update(recurrences)
          .set(updatePayload)
          .where(and(eq(recurrences.id, recurrence.id), eq(recurrences.version, currentVersion)))
          .returning();

        if (updatedRecurrence) {
          updatedRecurrenceSnapshot = updatedRecurrence;
          updateApplied = true;
          if (shouldFinalize) finalizedRecurrences += 1;
          break;
        }

        retries += 1;
      }

      if (!updateApplied) {
        this.app.log.warn(
          { recurrenceId: recurrence.id, userId: recurrence.userId },
          "Skipping recurrence state update due to concurrent version change",
        );
      } else if (
        updatedRecurrenceSnapshot &&
        (localCreated > 0 || localSkipped > 0 || shouldFinalize)
      ) {
        await this.recurrenceAudit.logBestEffort(
          {
            userId: recurrence.userId,
            entityType: "recurrence",
            entityId: recurrence.id,
            action: "update",
            beforeData: this.recurrenceAudit.toAuditData(recurrence),
            afterData: this.recurrenceAudit.toAuditData(updatedRecurrenceSnapshot),
            metadata: {
              operation: "recurrence-materialize",
              fromDate: localFirstProcessedDate,
              toDate: localLastMaterializedDate ?? cursorDate,
              createdOccurrences: localCreated,
              skippedOccurrences: localSkipped,
              createdTransactions: localTransactions,
              createdTransfers: localTransfers,
              finalized: shouldFinalize,
            },
          },
          {
            recurrenceId: recurrence.id,
            userId: recurrence.userId,
            operation: "recurrence-materialize",
          },
        );
      }

      createdOccurrences += localCreated;
      skippedOccurrences += localSkipped;
      createdTransactions += localTransactions;
      createdTransfers += localTransfers;
    }

    return {
      totalActiveRecurrences: totalActive,
      processedRecurrences: activeRecurrences.length,
      truncatedByBatch: totalActive > activeRecurrences.length,
      remainingRecurrences: Math.max(0, totalActive - activeRecurrences.length),
      createdOccurrences,
      skippedOccurrences,
      createdTransactions,
      createdTransfers,
      finalizedRecurrences,
      failedRecurrences,
    };
  }
}
