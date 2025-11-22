import { z } from "zod";

// 📌 Schema de Registro
export const registerSchema = z.object({
  name: z
    .string()
    .min(3, "O nome deve ter pelo menos 3 caracteres.")
    .max(255, "O nome é muito longo."),
  email: z.string().email("Formato de e-mail inválido.").max(255, "O e-mail é muito longo."),
  password: z
    .string()
    .min(6, "A senha deve ter pelo menos 6 caracteres.")
    .max(255, "A senha é muito longa."),
});

// 📌 Tipo derivado automaticamente
export type RegisterInput = z.infer<typeof registerSchema>;

// 📌 Schema de Login
export const loginSchema = z.object({
  email: z.string().email("Formato de e-mail inválido.").max(255, "O e-mail é muito longo."),
  password: z
    .string()
    .min(6, "A senha deve ter pelo menos 6 caracteres.")
    .max(255, "A senha é muito longa."),
});

// 📌 Tipo derivado automaticamente
export type LoginInput = z.infer<typeof loginSchema>;
