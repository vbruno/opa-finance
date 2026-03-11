import { z } from "zod";

export const trialBalanceQuerySchema = z.object({
  year: z.coerce
    .number()
    .int({ message: "Ano inválido." })
    .min(2000, { message: "Ano inválido." })
    .max(2100, { message: "Ano inválido." }),
  accountIds: z
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
    .transform((ids) => Array.from(new Set(ids))),
});

export type TrialBalanceQuery = z.infer<typeof trialBalanceQuerySchema>;

export type TrialBalanceLine = {
  subcategoryId: string;
  subcategoryName: string;
  months: number[];
  yearTotal: number;
};

export type TrialBalanceCategory = {
  categoryId: string;
  categoryName: string;
  months: number[];
  yearTotal: number;
  subcategories: TrialBalanceLine[];
};

export type TrialBalanceTotals = {
  months: number[];
  yearTotal: number;
};

export type TrialBalanceResponse = {
  year: number;
  accountIds: string[];
  income: TrialBalanceCategory[];
  expense: TrialBalanceCategory[];
  totals: {
    income: TrialBalanceTotals;
    expense: TrialBalanceTotals;
  };
};
