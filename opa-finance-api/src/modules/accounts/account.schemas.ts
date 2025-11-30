// account.schemas.ts
import { z } from "zod";
import { accountTypeEnum } from "@/db/schema";

// Criar conta
export const createAccountSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório."),
  type: z.enum(accountTypeEnum.enumValues),
  initialBalance: z.coerce.number().default(0),
  color: z.string().optional(),
  icon: z.string().optional(),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

// Atualizar conta
export const updateAccountSchema = z
  .object({
    name: z.string().min(1).optional(),
    type: z.enum(accountTypeEnum.enumValues).optional(),
    initialBalance: z.coerce.number().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Pelo menos um campo deve ser atualizado.",
  });
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

// Params
export const accountParamsSchema = z.object({
  id: z.string().uuid(),
});
export type AccountParams = z.infer<typeof accountParamsSchema>;
