// src/modules/accounts/account.enums.ts
import { accountTypeEnum } from "@/db/schema";

// ⚡ Converte enumValues (string[]) para readonly tuple
export const accountTypes = [...accountTypeEnum.enumValues] as const;

// Inferência do tipo
export type AccountType = (typeof accountTypes)[number];
