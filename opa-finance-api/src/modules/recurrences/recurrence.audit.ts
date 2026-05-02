import type { FastifyBaseLogger } from "fastify";
import type { recurrenceOccurrences, recurrences } from "../../db/schema";
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
      postingMode: serialized.postingMode,
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

  toOccurrenceAuditData(
    row: typeof recurrenceOccurrences.$inferSelect,
    reviewPayload?: Record<string, unknown> | null,
  ): Record<string, unknown> {
    const payload = reviewPayload ?? null;
    const metadata = this.getObject(row.metadata);
    const amount =
      typeof payload?.amount === "number"
        ? payload.amount
        : typeof payload?.amount === "string"
          ? payload.amount
          : this.getStringValue(metadata, "amount");
    const adjustments =
      metadata && typeof metadata.adjustments === "object"
        ? (metadata.adjustments as Record<string, unknown>)
        : null;

    return {
      id: row.id,
      recurrenceId: row.recurrenceId,
      originType: row.originType,
      occurrenceDate: row.occurrenceDate,
      status: row.status,
      description: this.getStringValue(payload, "description"),
      notes: this.getStringValue(payload, "notes"),
      amount,
      accountId: this.getStringValue(payload, "accountId"),
      categoryId: this.getStringValue(payload, "categoryId"),
      subcategoryId: this.getStringValue(payload, "subcategoryId"),
      fromAccountId: this.getStringValue(payload, "fromAccountId"),
      toAccountId: this.getStringValue(payload, "toAccountId"),
      transactionId: row.transactionId,
      transferId: row.transferId,
      version: row.version,
      confirmedAt: this.getStringValue(metadata, "confirmedAt"),
      skippedAt: this.getStringValue(metadata, "skippedAt"),
      skipReason: this.getStringValue(metadata, "skipReason"),
      adjustments,
      source: this.getStringValue(metadata, "source"),
      generatedAt: this.getStringValue(metadata, "generatedAt"),
    };
  }

  private getObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private getStringValue(obj: Record<string, unknown> | null, key: string): string | null {
    const value = obj?.[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      return null;
    }
    return value;
  }
}
