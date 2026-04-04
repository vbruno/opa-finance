import { z } from "zod";
import { strongPasswordSchema } from "./password.schemas";

// 📌 Schema de Registro com comparação de senha
export const registerSchema = z
  .object({
    name: z
      .string()
      .min(3, "O nome deve ter pelo menos 3 caracteres.")
      .max(255, "O nome é muito longo."),
    email: z.email("Formato de e-mail inválido.").max(255, "O e-mail é muito longo."),
    timezone: z.string().optional(),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(8, "A confirmação deve ter pelo menos 8 caracteres."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"], // ➜ marca erro no campo correto
  });

// 📌 Tipo derivado automaticamente
export type RegisterInput = z.infer<typeof registerSchema>;

// 📌 Schema de Login
export const loginSchema = z.object({
  email: z.email("Formato de e-mail inválido.").max(255, "O e-mail é muito longo."),
  password: z
    .string()
    .min(6, "A senha deve ter pelo menos 6 caracteres.")
    .max(255, "A senha é muito longa."),
});

// 📌 Tipo derivado automaticamente
export type LoginInput = z.infer<typeof loginSchema>;
