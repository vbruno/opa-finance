import { z } from "zod";

export const accountTypes = [
  "cash",
  "checking_account",
  "savings_account",
  "credit_card",
  "investment",
] as const;

export const createAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(accountTypes),
  initialBalance: z.coerce.number().default(0),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const updateAccountSchema = z
  .object({
    name: z.string().min(1).optional(),
    type: z.enum(accountTypes).optional(),
    initialBalance: z.coerce.number().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Pelo menos um campo deve ser atualizado.",
  });

export const accountParamsSchema = z.object({
  id: z.string().uuid(),
});
