import { describe, expect, it } from "vitest";
import {
  addOneYearIsoDate,
  emptyMonths,
  getFirstOccurrenceForRecurrence,
  getNextOccurrenceAfterDate,
  mergeLastMaterializedDate,
  minIsoDate,
  resolveOperationalEndDate,
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

  describe("addOneYearIsoDate", () => {
    it("adiciona 1 ano preservando mês e dia", () => {
      expect(addOneYearIsoDate("2026-05-06")).toBe("2027-05-06");
    });

    it("ajusta 29/02 para o último dia válido do ano seguinte", () => {
      expect(addOneYearIsoDate("2024-02-29")).toBe("2025-02-28");
    });

    it("mantém 28/02 ao avançar para ano bissexto", () => {
      expect(addOneYearIsoDate("2023-02-28")).toBe("2024-02-28");
    });

    it("preserva 31/12 na virada de ano", () => {
      expect(addOneYearIsoDate("2026-12-31")).toBe("2027-12-31");
    });

    it("preserva 31/01 no início de ano", () => {
      expect(addOneYearIsoDate("2026-01-31")).toBe("2027-01-31");
    });
  });

  describe("minIsoDate", () => {
    it("retorna a menor data ignorando nulos", () => {
      expect(minIsoDate(undefined, "2027-05-06", "2026-12-31", null)).toBe("2026-12-31");
    });

    it("retorna null quando não há datas", () => {
      expect(minIsoDate(undefined, null)).toBeNull();
    });
  });

  describe("resolveOperationalEndDate", () => {
    it("usa startDate + 1 ano para recorrência sem fim", () => {
      expect(
        resolveOperationalEndDate({
          startDate: "2026-05-06",
          endType: "never",
          endDate: null,
        }),
      ).toBe("2027-05-06");
    });

    it("usa endDate para recorrência por data final", () => {
      expect(
        resolveOperationalEndDate({
          startDate: "2026-05-06",
          endType: "until_date",
          endDate: "2026-12-31",
        }),
      ).toBe("2026-12-31");
    });

    it("não cria horizonte operacional para recorrência por quantidade", () => {
      expect(
        resolveOperationalEndDate({
          startDate: "2026-05-06",
          endType: "by_occurrences",
          endDate: null,
        }),
      ).toBeNull();
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
      const row = { id: "r1", amount: "123.45" } as Parameters<typeof serializeRecurrence>[0];
      const result = serializeRecurrence(row);
      expect(result.amount).toBe(123.45);
      expect(typeof result.amount).toBe("number");
    });

    it("preserva todos os outros campos", () => {
      const row = {
        id: "r1",
        amount: "50",
        description: "Teste",
        status: "active",
      } as Parameters<typeof serializeRecurrence>[0];
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
