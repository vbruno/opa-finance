import type { FastifyBaseLogger } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DB } from "@/core/plugins/drizzle";
import { toIsoDate } from "@/modules/recurrences/recurrence.helpers";
import { RecurrenceValidators } from "@/modules/recurrences/recurrence.validators";

describe("recurrence validators now fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("usa Intl quando SQL falha", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-01T02:30:00.000Z"));

    const db = {
      execute: vi.fn().mockRejectedValue(new Error("sql failed")),
    } as unknown as DB;
    const logger = {
      warn: vi.fn(),
    } as unknown as FastifyBaseLogger;

    const validators = new RecurrenceValidators(db, logger);
    const today = await validators.getNowIsoDateInTimezone("America/Sao_Paulo");

    expect(today).toBe("2025-02-28");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ timezone: "America/Sao_Paulo" }),
      "getNowIsoDateInTimezone: SQL fallback to Intl",
    );
  });

  it("usa Intl quando SQL retorna valor inválido", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-01T02:30:00.000Z"));

    const db = {
      execute: vi.fn().mockResolvedValue({ rows: [{ today: "invalid" }] }),
    } as unknown as DB;
    const logger = {
      warn: vi.fn(),
    } as unknown as FastifyBaseLogger;

    const validators = new RecurrenceValidators(db, logger);
    const today = await validators.getNowIsoDateInTimezone("America/Sao_Paulo");

    expect(today).toBe("2025-02-28");
    expect(logger.warn).toHaveBeenCalledWith(
      { timezone: "America/Sao_Paulo", today: "invalid" },
      "getNowIsoDateInTimezone: SQL fallback to Intl",
    );
  });

  it("usa UTC quando Intl também falha", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-01T02:30:00.000Z"));

    const db = {
      execute: vi.fn().mockRejectedValue(new Error("sql failed")),
    } as unknown as DB;
    const logger = {
      warn: vi.fn(),
    } as unknown as FastifyBaseLogger;
    const intlSpy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function DateTimeFormat() {
      throw new Error("intl failed");
    } as typeof Intl.DateTimeFormat);

    const validators = new RecurrenceValidators(db, logger);
    const today = await validators.getNowIsoDateInTimezone("America/Sao_Paulo");

    expect(today).toBe(toIsoDate(new Date("2025-03-01T02:30:00.000Z")));
    expect(logger.warn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ timezone: "America/Sao_Paulo" }),
      "getNowIsoDateInTimezone: SQL fallback to Intl",
    );
    expect(logger.warn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ timezone: "America/Sao_Paulo" }),
      "getNowIsoDateInTimezone: Intl fallback to UTC",
    );
    expect(intlSpy).toHaveBeenCalled();
  });
});
