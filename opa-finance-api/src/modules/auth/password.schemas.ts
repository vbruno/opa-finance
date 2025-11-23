import { z } from "zod";

export const strongPasswordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(255, "A senha é muito longa.")
  .refine((value) => /[a-z]/.test(value), {
    message: "A senha deve conter pelo menos uma letra minúscula.",
  })
  .refine((value) => /[A-Z]/.test(value), {
    message: "A senha deve conter pelo menos uma letra maiúscula.",
  })
  .refine((value) => /[0-9]/.test(value), {
    message: "A senha deve conter pelo menos um número.",
  })
  .refine((value) => /[^A-Za-z0-9]/.test(value), {
    message: "A senha deve conter pelo menos um símbolo.",
  });

export type StrongPassword = z.infer<typeof strongPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6),
    newPassword: strongPasswordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "A confirmação da nova senha não confere.",
    path: ["confirmNewPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const temporaryPasswordSchema = z
  .string()
  .min(6, "A senha temporária deve ter no mínimo 6 caracteres.")
  .max(6, "A senha temporária deve ter exatamente 6 caracteres.")
  .regex(/^[0-9]+$/, "Senha temporária deve conter apenas números.");
