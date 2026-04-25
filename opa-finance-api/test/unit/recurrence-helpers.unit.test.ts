import { describe, expect, it } from "vitest";
import {
  emptyMonths,
  getFirstOccurrenceForRecurrence,
  getNextOccurrenceAfterDate,
  mergeLastMaterializedDate,
  serializeRecurrence,
  sumYear,
  toIsoDate,
} from "@/modules/recurrences/recurrence.helpers";

describe("recurrence helpers (unit)", () => {
  describe("toIsoDate", () => {
    it("converte Date para string ISO YYYY-MM-DD", () => {
      expect(toIsoDate(new Date("2025-03-15T14:30:00.000Z"))).toBe("2025-03-15");
    });

    it("usa UTC, não timezone local", () => {
      const d = new Date("2025-12-31T23:59:59.000Z");
      expect(toIsoDate(d)).toBe("2025-12-31");
    });
  });

  describe("mergeLastMaterializedDate", () => {
    it("retorna candidateDate quando base é null", () => {
      expect(mergeLastMaterializedDate(null, "2025-06-01")).toBe("2025-06-01");
    });

    it("retorna baseDate quando candidate é null", () => {
      expect(mergeLastMaterializedDate("2025-06-01", null)).toBe("2025-06-01");
    });

    it("retorna null quando ambos são null", () => {
      expect(mergeLastMaterializedDate(null, null)).toBeNull();
    });

    it("retorna a data maior quando candidate > base", () => {
      expect(mergeLastMaterializedDate("2025-05-01", "2025-06-01")).toBe("2025-06-01");
    });

    it("retorna baseDate quando base >= candidate", () => {
      expect(mergeLastMaterializedDate("2025-06-01", "2025-05-01")).toBe("2025-06-01");
    });

    it("retorna baseDate quando datas são iguais", () => {
      expect(mergeLastMaterializedDate("2025-06-01", "2025-06-01")).toBe("2025-06-01");
    });
  });

  describe("emptyMonths", () => {
    it("retorna array de 12 zeros", () => {
      const result = emptyMonths();
      expect(result).toHaveLength(12);
      expect(result.every((v) => v === 0)).toBe(true);
    });

    it("retorna nova instância a cada chamada", () => {
      const a = emptyMonths();
      const b = emptyMonths();
      a[0] = 99;
      expect(b[0]).toBe(0);
    });
  });

  describe("sumYear", () => {
    it("soma todos os meses", () => {
      expect(sumYear([100, 200, 0, 0, 0, 50, 0, 0, 0, 0, 0, 150])).toBe(500);
    });

    it("retorna 0 para array de zeros", () => {
      expect(sumYear(emptyMonths())).toBe(0);
    });
  });

  describe("serializeRecurrence", () => {
    it("converte amount de string/Decimal para number", () => {
      const row = { id: "r1", amount: "123.45" } as any;
      const result = serializeRecurrence(row);
      expect(result.amount).toBe(123.45);
      expect(typeof result.amount).toBe("number");
    });

    it("preserva todos os outros campos", () => {
      const row = { id: "r1", amount: "50", description: "Teste", status: "active" } as any;
      const result = serializeRecurrence(row);
      expect(result.id).toBe("r1");
      expect(result.description).toBe("Teste");
      expect(result.status).toBe("active");
    });
  });

  describe("getFirstOccurrenceForRecurrence", () => {
    it("retorna a primeira ocorrência para recorrência mensal", () => {
      const date = getFirstOccurrenceForRecurrence({
        startDate: "2025-01-15",
        frequency: "monthly",
        dayOfWeek: null,
        dayOfMonth: 15,
        monthOfYear: null,
      });
      expect(date).toBe("2025-01-15");
    });
  });

  describe("getNextOccurrenceAfterDate", () => {
    it("retorna a próxima ocorrência após a data dada para recorrência mensal", () => {
      const next = getNextOccurrenceAfterDate(
        {
          startDate: "2025-01-15",
          frequency: "monthly",
          dayOfWeek: null,
          dayOfMonth: 15,
          monthOfYear: null,
        },
        "2025-01-15",
      );
      expect(next).toBe("2025-02-15");
    });
  });
});
