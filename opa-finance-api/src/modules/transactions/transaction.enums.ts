import { toEnumValues } from "@/core/utils/enum.utils";
import { transactionType } from "@/db/schema";

/* -------------------------------------------------------------------------- */
/*                        ENUM DRIZZLE → ENUM ZOD                              */
/* -------------------------------------------------------------------------- */

// Converte o enum do Drizzle em uma tupla literal
export const transactionTypes = toEnumValues(transactionType.enumValues);

// Tipo Zod-friendly e Drizzle-friendly
export type TransactionType = (typeof transactionType.enumValues)[number];
