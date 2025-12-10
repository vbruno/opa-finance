// src/modules/transactions/transaction.enums.ts
import { toEnumValues } from "@/core/utils/enum.utils";
import { transactionType } from "@/db/schema";

/* -------------------------------------------------------------------------- */
/*                        ENUM DRIZZLE → ENUM ZOD                              */
/* -------------------------------------------------------------------------- */

// Converte o enum do Drizzle em tupla literal para uso no Zod
export const transactionTypes = toEnumValues(transactionType.enumValues);

export type TransactionType = (typeof transactionTypes)[number];
