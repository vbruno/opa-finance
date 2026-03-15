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

export const weeklyCashflowQuerySchema = z.object({
  year: z.coerce
    .number()
    .int({ message: "Ano inválido." })
    .min(2000, { message: "Ano inválido." })
    .max(2100, { message: "Ano inválido." }),
  weekStart: z.enum(["monday", "sunday"]).default("monday"),
  accountIds: accountIdsSchema,
});

export type WeeklyCashflowQuery = z.infer<typeof weeklyCashflowQuerySchema>;
export type WeekStart = WeeklyCashflowQuery["weekStart"];

export type WeeklyCashflowColumn = {
  id: string;
  label: string;
  type: "income" | "expense";
  scope: "category" | "subcategory";
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
};

export type WeeklyCashflowWeekRow = {
  week: number;
  startDate: string;
  endDate: string;
  total: number;
  received: number;
  spent: number;
  dynamicValues: Record<string, number>;
};

export type WeeklyCashflowResponse = {
  year: number;
  weekStart: WeekStart;
  appliedAccountIds: string[];
  defaultAccountId: string | null;
  summaryColumns: ["total", "received", "spent"];
  columnsCatalog: WeeklyCashflowColumn[];
  weeks: WeeklyCashflowWeekRow[];
};
