import { z } from "zod";

const accountIdsSchema = z
  .preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") {
        return [];
      }

      if (Array.isArray(value)) {
        return value.flatMap((item) =>
          typeof item === "string"
            ? item
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean)
            : [],
        );
      }

      if (typeof value === "string") {
        return value
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
      }

      return [];
    },
    z.array(z.string().uuid({ message: "ID de conta inválido." })).default([]),
  )
  .transform((ids) => Array.from(new Set(ids)));

export const consolidatedQuerySchema = z.object({
  year: z.coerce
    .number()
    .int({ message: "Ano inválido." })
    .min(2000, { message: "Ano inválido." })
    .max(2100, { message: "Ano inválido." }),
  accountIds: accountIdsSchema,
});

export type ConsolidatedQuery = z.infer<typeof consolidatedQuerySchema>;
export const consolidatedYearsQuerySchema = z.object({
  accountIds: accountIdsSchema,
});
export type ConsolidatedYearsQuery = z.infer<typeof consolidatedYearsQuerySchema>;

export type ConsolidatedLine = {
  subcategoryId: string;
  subcategoryName: string;
  months: number[];
  yearTotal: number;
};

export type ConsolidatedCategory = {
  categoryId: string;
  categoryName: string;
  months: number[];
  yearTotal: number;
  subcategories: ConsolidatedLine[];
};

export type ConsolidatedTotals = {
  months: number[];
  yearTotal: number;
};

export type ConsolidatedResponse = {
  year: number;
  accountIds: string[];
  income: ConsolidatedCategory[];
  expense: ConsolidatedCategory[];
  totals: {
    income: ConsolidatedTotals;
    expense: ConsolidatedTotals;
  };
};

export type ConsolidatedYearsResponse = {
  years: number[];
};
