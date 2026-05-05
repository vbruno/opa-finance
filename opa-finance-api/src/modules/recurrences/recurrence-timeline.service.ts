import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { NotFoundProblem } from "../../core/errors/problems";
import {
  compareIsoDate,
  getFirstOccurrenceOnOrAfter,
  getNextOccurrenceAfter,
  type RecurrenceSchedule,
} from "../../core/utils/recurrence-schedule.utils";
import { recurrences, recurrenceOccurrences, transactions } from "../../db/schema";
import { minIsoDate, resolveOperationalEndDate, serializeRecurrence } from "./recurrence.helpers";
import type { RecurrenceTimelineQuery } from "./recurrence.schemas";
import { recurrenceOccurrenceReviewPayloadSchema } from "./recurrence.schemas";

type SerializedRecurrence = ReturnType<typeof serializeRecurrence>;

type TimelineStatus = "pending_review" | "materialized" | "skipped" | "failed" | "projected";

type TimelineItem = {
  id: string | null;
  sequence: number | null;
  occurrenceDate: string;
  status: TimelineStatus;
  source: "persisted" | "projected";
  amount: number;
  transactionId: string | null;
  transferId: string | null;
  version: number | null;
  reviewPayload: unknown | null;
  canConfirm: boolean;
  canSkip: boolean;
};

type TimelineSummary = {
  totalOccurrences: number | null;
  consumedOccurrences: number;
  materializedOccurrences: number;
  pendingReviewOccurrences: number;
  skippedOccurrences: number;
  failedOccurrences: number;
  projectedOccurrences: number;
  totalAmount: number | null;
  materializedAmount: number;
  pendingReviewAmount: number;
  projectedAmount: number;
  appliedLimit: number;
  isPartial: boolean;
  hasMoreProjected: boolean;
  projectionWindowLabel: string | null;
};

type TimelinePagination = {
  page: number;
  limit: number;
  hasMore: boolean;
  total: number | null;
};

type TimelineResponse = {
  recurrence: SerializedRecurrence;
  summary: TimelineSummary;
  items: TimelineItem[];
  pagination: TimelinePagination;
};

type TimelineOccurrenceRow = {
  id: string;
  occurrenceDate: string;
  status: "materialized" | "failed" | "pending_review" | "skipped";
  transactionId: string | null;
  transferId: string | null;
  version: number;
  reviewPayload: unknown;
};

type TimelineCounts = {
  materializedOccurrences: number;
  pendingReviewOccurrences: number;
  skippedOccurrences: number;
  failedOccurrences: number;
  materializedAmount: number;
  pendingReviewAmount: number;
};

export class RecurrenceTimelineService {
  constructor(private app: FastifyInstance) {}

  private formatIsoDate(date: string) {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  }

  private resolveOccurrenceAmount(
    recurrence: SerializedRecurrence,
    occurrence: TimelineOccurrenceRow | undefined,
    materializedAmounts: Map<string, number>,
  ) {
    if (occurrence?.status === "materialized" && occurrence.transactionId) {
      const live = materializedAmounts.get(occurrence.transactionId);
      if (live !== undefined) return live;
    }

    if (!occurrence?.reviewPayload) {
      return recurrence.amount;
    }

    const parsed = recurrenceOccurrenceReviewPayloadSchema.safeParse(occurrence.reviewPayload);
    if (!parsed.success) {
      return recurrence.amount;
    }

    return parsed.data.amount;
  }

  private resolveConsumedOccurrences(counts: TimelineCounts) {
    return [
      counts.materializedOccurrences,
      counts.pendingReviewOccurrences,
      counts.skippedOccurrences,
    ].reduce((acc, value) => acc + value, 0);
  }

  private resolveTimelineLabel(
    query: RecurrenceTimelineQuery,
    hasMoreProjected: boolean,
    recurrence: SerializedRecurrence,
  ) {
    if (!hasMoreProjected) return null;
    if (query.untilDate) {
      return `Até ${this.formatIsoDate(query.untilDate)} (parcial)`;
    }
    if (recurrence.endType === "by_occurrences") {
      return `Próximas ${query.limit} ocorrências`;
    }
    return `Próximas ${query.limit} ocorrências`;
  }

  private countOccurrences(
    schedule: RecurrenceSchedule,
    startDate: string,
    endDate: string,
  ): number {
    let count = 0;
    let cursorDate = getFirstOccurrenceOnOrAfter(schedule, startDate);
    while (compareIsoDate(cursorDate, endDate) <= 0) {
      count++;
      try {
        cursorDate = getNextOccurrenceAfter(schedule, cursorDate);
      } catch {
        break;
      }
    }
    return count;
  }

  async timeline(userId: string, recurrenceId: string, query: RecurrenceTimelineQuery) {
    const [recurrenceRow] = await this.app.db
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

    if (!recurrenceRow) {
      throw new NotFoundProblem(
        "Recorrência não encontrada.",
        `/recurrences/${recurrenceId}/timeline`,
      );
    }

    const recurrence = serializeRecurrence(recurrenceRow);
    const schedule: RecurrenceSchedule = {
      startDate: recurrence.startDate,
      frequency: recurrence.frequency,
      dayOfWeek: recurrence.dayOfWeek,
      dayOfMonth: recurrence.dayOfMonth,
      monthOfYear: recurrence.monthOfYear,
    };

    const persistedRows: TimelineOccurrenceRow[] = await this.app.db
      .select({
        id: recurrenceOccurrences.id,
        occurrenceDate: recurrenceOccurrences.occurrenceDate,
        status: recurrenceOccurrences.status,
        transactionId: recurrenceOccurrences.transactionId,
        transferId: recurrenceOccurrences.transferId,
        version: recurrenceOccurrences.version,
        reviewPayload: recurrenceOccurrences.reviewPayload,
      })
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrenceId))
      .orderBy(asc(recurrenceOccurrences.occurrenceDate));

    const persistedByDate = new Map(persistedRows.map((row) => [row.occurrenceDate, row]));

    const materializedTransactionIds = persistedRows
      .filter((r) => r.status === "materialized" && r.transactionId)
      .map((r) => r.transactionId as string);

    const materializedAmounts = new Map<string, number>();
    if (materializedTransactionIds.length > 0) {
      const txRows = await this.app.db
        .select({ id: transactions.id, amount: transactions.amount })
        .from(transactions)
        .where(
          and(
            inArray(transactions.id, materializedTransactionIds),
            eq(transactions.userId, userId),
          ),
        );
      for (const row of txRows) {
        materializedAmounts.set(row.id, Number(row.amount));
      }
    }

    const counts = persistedRows.reduce<TimelineCounts>(
      (acc, row) => {
        const amount = this.resolveOccurrenceAmount(recurrence, row, materializedAmounts);
        if (row.status === "materialized") {
          acc.materializedOccurrences += 1;
          acc.materializedAmount += amount;
        } else if (row.status === "pending_review") {
          acc.pendingReviewOccurrences += 1;
          acc.pendingReviewAmount += amount;
        } else if (row.status === "skipped") {
          acc.skippedOccurrences += 1;
        } else if (row.status === "failed") {
          acc.failedOccurrences += 1;
        }
        return acc;
      },
      {
        materializedOccurrences: 0,
        pendingReviewOccurrences: 0,
        skippedOccurrences: 0,
        failedOccurrences: 0,
        materializedAmount: 0,
        pendingReviewAmount: 0,
      },
    );

    // Compute pagination offset
    const page = query.page;
    const limit = query.limit;

    // For desc with finite recurrences, compute reverse offset so page 1 = newest
    let reverseOffset: number | null = null;
    let paginationTotal: number | null = null;
    const operationalEndDate = resolveOperationalEndDate(recurrence);
    const effectiveEndDate = minIsoDate(query.untilDate, operationalEndDate);

    if (recurrence.endType === "by_occurrences" && recurrence.endOccurrences) {
      paginationTotal = recurrence.endOccurrences;
    } else if (
      operationalEndDate &&
      (recurrence.endType === "until_date" || recurrence.endType === "never")
    ) {
      paginationTotal = this.countOccurrences(schedule, recurrence.startDate, operationalEndDate);
    }

    if (query.dir === "desc") {
      if (paginationTotal !== null) {
        reverseOffset = Math.max(0, paginationTotal - page * limit);
      }
      // 'never' endType: reverseOffset stays null → falls back to asc window
    }

    const effectiveOffset = reverseOffset !== null ? reverseOffset : (page - 1) * limit;

    const items: TimelineItem[] = [];
    let projectedOccurrences = 0;
    let projectedAmount = 0;
    let sequence = 0;
    let persistedIndex = 0;
    let processedCount = 0;
    let cursorDate = getFirstOccurrenceOnOrAfter(schedule, recurrence.startDate);
    let paginationHasMore = false;

    const shouldUseSequence =
      recurrence.endType === "by_occurrences" || recurrence.endType === "until_date";

    while (true) {
      if (effectiveEndDate && compareIsoDate(cursorDate, effectiveEndDate) > 0) {
        break;
      }

      if (shouldUseSequence && recurrence.endOccurrences && sequence >= recurrence.endOccurrences) {
        break;
      }

      const persisted = persistedByDate.get(cursorDate);
      const amount = this.resolveOccurrenceAmount(recurrence, persisted, materializedAmounts);
      const canReview = persisted?.status === "pending_review" && recurrence.status === "active";
      const sequenceValue = shouldUseSequence ? sequence + 1 : null;
      const isProjected = !persisted && query.includeProjected && recurrence.status === "active";

      if (persisted) persistedIndex++;

      if (persisted || isProjected) {
        if (processedCount < effectiveOffset) {
          processedCount++;
        } else if (items.length < limit) {
          if (persisted) {
            items.push({
              id: persisted.id,
              sequence: sequenceValue,
              occurrenceDate: persisted.occurrenceDate,
              status: persisted.status,
              source: "persisted",
              amount,
              transactionId: persisted.transactionId,
              transferId: persisted.transferId,
              version: persisted.version,
              reviewPayload: persisted.reviewPayload,
              canConfirm: canReview,
              canSkip: canReview,
            });
          } else {
            items.push({
              id: null,
              sequence: sequenceValue,
              occurrenceDate: cursorDate,
              status: "projected",
              source: "projected",
              amount: recurrence.amount,
              transactionId: null,
              transferId: null,
              version: null,
              reviewPayload: null,
              canConfirm: true,
              canSkip: false,
            });
            projectedOccurrences++;
            projectedAmount += recurrence.amount;
          }
          processedCount++;
        } else {
          paginationHasMore = true;
          break;
        }
      }

      sequence++;

      if (!query.includeProjected && persistedIndex >= persistedRows.length) {
        break;
      }

      if (recurrence.status !== "active" && persistedIndex >= persistedRows.length) {
        break;
      }

      try {
        cursorDate = getNextOccurrenceAfter(schedule, cursorDate);
      } catch {
        break;
      }
    }

    // For desc with known total: reverse items and derive hasMore from reverseOffset
    if (query.dir === "desc" && reverseOffset !== null) {
      items.reverse();
      paginationHasMore = reverseOffset > 0;
    }

    const consumedOccurrences = this.resolveConsumedOccurrences(counts);
    const hasMoreProjected = (() => {
      if (recurrence.status !== "active") return false;
      if (recurrence.endType === "by_occurrences" && recurrence.endOccurrences) {
        return consumedOccurrences + projectedOccurrences < recurrence.endOccurrences;
      }
      if (recurrence.endType === "until_date" && recurrence.endDate) {
        if (!query.includeProjected) return false;
        if (paginationHasMore) return true;
        return Boolean(query.untilDate && compareIsoDate(query.untilDate, recurrence.endDate) < 0);
      }
      if (recurrence.endType === "never" && operationalEndDate) {
        if (!query.includeProjected) return false;
        if (paginationHasMore) return true;
        return Boolean(query.untilDate && compareIsoDate(query.untilDate, operationalEndDate) < 0);
      }
      return false;
    })();

    const summary: TimelineSummary = {
      totalOccurrences:
        recurrence.endType === "by_occurrences" && recurrence.endOccurrences
          ? recurrence.endOccurrences
          : recurrence.endType === "until_date"
            ? paginationTotal
            : null,
      consumedOccurrences,
      materializedOccurrences: counts.materializedOccurrences,
      pendingReviewOccurrences: counts.pendingReviewOccurrences,
      skippedOccurrences: counts.skippedOccurrences,
      failedOccurrences: counts.failedOccurrences,
      projectedOccurrences,
      totalAmount: hasMoreProjected ? null : items.reduce((acc, item) => acc + item.amount, 0),
      materializedAmount: counts.materializedAmount,
      pendingReviewAmount: counts.pendingReviewAmount,
      projectedAmount,
      appliedLimit: query.limit,
      isPartial: hasMoreProjected,
      hasMoreProjected,
      projectionWindowLabel: this.resolveTimelineLabel(query, hasMoreProjected, recurrence),
    };

    const pagination: TimelinePagination = {
      page,
      limit,
      hasMore: paginationHasMore,
      total: paginationTotal,
    };

    return {
      recurrence,
      summary,
      items,
      pagination,
    } satisfies TimelineResponse;
  }
}
