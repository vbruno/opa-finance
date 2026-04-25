import type { FastifyBaseLogger } from "fastify";
import type { recurrences } from "../../db/schema";
import { AuditService } from "../audit/audit.service";
import { serializeRecurrence } from "./recurrence.helpers";

export class RecurrenceAudit {
  constructor(
    private auditService: AuditService,
    private log: FastifyBaseLogger,
  ) {}

  async logBestEffort(
    payload: Parameters<AuditService["log"]>[0],
    context: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditService.log(payload);
    } catch (error) {
      this.log.error(
        {
          event: "recurrences.audit.log_failed",
          ...context,
          error,
        },
        "Failed to persist recurrence audit log.",
      );
    }
  }

  toAuditData(
    row: typeof recurrences.$inferSelect | ReturnType<typeof serializeRecurrence>,
  ): Record<string, unknown> {
    const serialized =
      typeof (row as { amount?: unknown }).amount === "number"
        ? (row as ReturnType<typeof serializeRecurrence>)
        : serializeRecurrence(row as typeof recurrences.$inferSelect);
    return {
      id: serialized.id,
      originType: serialized.originType,
      status: serialized.status,
      timezone: serialized.timezone,
      frequency: serialized.frequency,
      startDate: serialized.startDate,
      dayOfWeek: serialized.dayOfWeek,
      dayOfMonth: serialized.dayOfMonth,
      monthOfYear: serialized.monthOfYear,
      endType: serialized.endType,
      endOccurrences: serialized.endOccurrences,
      endDate: serialized.endDate,
      accountId: serialized.accountId,
      categoryId: serialized.categoryId,
      subcategoryId: serialized.subcategoryId,
      fromAccountId: serialized.fromAccountId,
      toAccountId: serialized.toAccountId,
      amount: serialized.amount,
      description: serialized.description,
      notes: serialized.notes,
      nextOccurrenceDate: serialized.nextOccurrenceDate,
      lastMaterializedDate: serialized.lastMaterializedDate,
      finalizedAt: serialized.finalizedAt,
      deletedAt: serialized.deletedAt,
      version: serialized.version,
    };
  }
}
