import { and, asc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { NotFoundProblem } from "../../core/errors/problems";
import {
  compareIsoDate,
  getFirstOccurrenceOnOrAfter,
  getNextOccurrenceAfter,
  type RecurrenceSchedule,
} from "../../core/utils/recurrence-schedule.utils";
import { recurrences, recurrenceOccurrences } from "../../db/schema";
import { serializeRecurrence } from "./recurrence.helpers";
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

type TimelineResponse = {
  recurrence: SerializedRecurrence;
  summary: TimelineSummary;
  items: TimelineItem[];
};

type TimelineOccurrenceRow = {
  id: string;
  occurrenceDate: string;
  status: "materialized" | "failed" | "pending_review" | "skipped";
  transactionId: string | null;
  transferId: string | null;
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
  ) {
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
        reviewPayload: recurrenceOccurrences.reviewPayload,
      })
      .from(recurrenceOccurrences)
      .where(eq(recurrenceOccurrences.recurrenceId, recurrenceId))
      .orderBy(asc(recurrenceOccurrences.occurrenceDate));

    const persistedByDate = new Map(persistedRows.map((row) => [row.occurrenceDate, row]));

    const counts = persistedRows.reduce<TimelineCounts>(
      (acc, row) => {
        const amount = this.resolveOccurrenceAmount(recurrence, row);
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

    const items: TimelineItem[] = [];
    let projectedOccurrences = 0;
    let projectedAmount = 0;
    let sequence = 0;
    let persistedIndex = 0;
    let cursorDate = getFirstOccurrenceOnOrAfter(schedule, recurrence.startDate);
    let lastProcessedDate: string | null = null;

    const untilDate = query.untilDate ?? null;
    const shouldUseSequence = recurrence.endType === "by_occurrences";

    while (true) {
      if (untilDate && compareIsoDate(cursorDate, untilDate) > 0) {
        break;
      }

      if (shouldUseSequence && recurrence.endOccurrences && sequence >= recurrence.endOccurrences) {
        break;
      }

      const persisted = persistedByDate.get(cursorDate);
      const amount = this.resolveOccurrenceAmount(recurrence, persisted);
      const canReview = persisted?.status === "pending_review" && recurrence.status === "active";
      const sequenceValue = shouldUseSequence ? sequence + 1 : null;

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
        persistedIndex += 1;
      } else if (query.includeProjected && recurrence.status === "active") {
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
          canConfirm: false,
          canSkip: false,
        });
        projectedOccurrences += 1;
        projectedAmount += recurrence.amount;
      }

      lastProcessedDate = cursorDate;
      sequence += 1;

      if (query.includeProjected && items.length >= query.limit) {
        break;
      }

      if (!query.includeProjected && items.length >= query.limit) {
        break;
      }

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

    const consumedOccurrences = this.resolveConsumedOccurrences(counts);
    const hasMoreProjected = (() => {
      if (recurrence.status !== "active") return false;
      if (recurrence.endType === "never") return true;
      if (recurrence.endType === "by_occurrences" && recurrence.endOccurrences) {
        return consumedOccurrences + projectedOccurrences < recurrence.endOccurrences;
      }
      if (recurrence.endType === "until_date" && recurrence.endDate) {
        const referenceDate = lastProcessedDate ?? untilDate ?? recurrence.startDate;
        return compareIsoDate(referenceDate, recurrence.endDate) < 0;
      }
      return false;
    })();

    const summary: TimelineSummary = {
      totalOccurrences:
        recurrence.endType === "by_occurrences" && recurrence.endOccurrences
          ? recurrence.endOccurrences
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

    return {
      recurrence,
      summary,
      items,
    } satisfies TimelineResponse;
  }
}
