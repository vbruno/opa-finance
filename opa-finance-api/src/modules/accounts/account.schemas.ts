// src/modules/accounts/account.schemas.ts
import { z } from "zod";
import { accountTypes } from "./account.enum";

/* -------------------------------------------------------------------------- */
/*                               CREATE ACCOUNT                                */
/* -------------------------------------------------------------------------- */

export const createAccountSchema = z.object({
  name: z.string({ message: "Nome é obrigatório." }).min(1, { message: "Nome é obrigatório." }),

  type: z.enum(accountTypes, {
    message: "Tipo de conta inválido.",
  }),

  // Aceita string OU null
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),

  isPrimary: z.boolean().optional().default(false),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

/* -------------------------------------------------------------------------- */
/*                               UPDATE ACCOUNT                                */
/* -------------------------------------------------------------------------- */

export const updateAccountSchema = z
  .object({
    name: z.string().min(1, { message: "Nome é obrigatório." }).optional(),

    type: z.enum(accountTypes, { message: "Tipo de conta inválido." }).optional(),

    // Mesma correção aqui:
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),

    isPrimary: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Pelo menos um campo deve ser atualizado.",
  });

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

/* -------------------------------------------------------------------------- */
/*                                 ROUTE PARAMS                                */
/* -------------------------------------------------------------------------- */

export const accountParamsSchema = z.object({
  id: z.uuid({ message: "ID inválido." }),
});

export type AccountParams = z.infer<typeof accountParamsSchema>;
