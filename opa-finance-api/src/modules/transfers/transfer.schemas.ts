// src/modules/transfers/transfer.schemas.ts
import { z } from "zod";

export const createTransferSchema = z.object({
  fromAccountId: z.uuid({ message: "Conta de origem inválida." }),
  toAccountId: z.uuid({ message: "Conta de destino inválida." }),
  amount: z.coerce.number().positive("Valor deve ser maior que zero."),
  date: z.string().min(1, "Data é obrigatória."),
  description: z.string().max(255).optional(),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
