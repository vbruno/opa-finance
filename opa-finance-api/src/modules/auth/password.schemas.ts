import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                          STRONG PASSWORD RULES                             */
/* -------------------------------------------------------------------------- */

export const strongPasswordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(255, "A senha é muito longa.")
  .superRefine((value, ctx) => {
    if (!/[a-z]/.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: "A senha deve conter pelo menos uma letra minúscula.",
      });
    }

    if (!/[A-Z]/.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: "A senha deve conter pelo menos uma letra maiúscula.",
      });
    }

    if (!/[0-9]/.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: "A senha deve conter pelo menos um número.",
      });
    }

    if (!/[^A-Za-z0-9]/.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: "A senha deve conter pelo menos um símbolo.",
      });
    }
  });

export type StrongPassword = z.infer<typeof strongPasswordSchema>;

/* -------------------------------------------------------------------------- */
/*                          CHANGE PASSWORD SCHEMA                            */
/* -------------------------------------------------------------------------- */

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "A senha atual é obrigatória." }),

    newPassword: strongPasswordSchema,

    confirmNewPassword: z
      .string()
      .min(1, { message: "A confirmação da nova senha é obrigatória." }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "A confirmação da nova senha não confere.",
    path: ["confirmNewPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/* -------------------------------------------------------------------------- */
/*                         TEMPORARY PASSWORD                                 */
/* -------------------------------------------------------------------------- */

export const temporaryPasswordSchema = z
  .string()
  .min(6, "A senha temporária deve ter no mínimo 6 caracteres.")
  .max(6, "A senha temporária deve ter exatamente 6 caracteres.")
  .regex(/^[0-9]+$/, "Senha temporária deve conter apenas números.");

export const forgotPasswordSchema = z.object({
  email: z.email("E-mail inválido."),
});

/* -------------------------------------------------------------------------- */
/*                           RESET PASSWORD                                   */
/* -------------------------------------------------------------------------- */

export const resetPasswordSchema = z
  .object({
    token: z.string(),

    newPassword: strongPasswordSchema,

    confirmNewPassword: z.string().min(1, "A confirmação da nova senha é obrigatória."),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "As senhas não conferem.",
    path: ["confirmNewPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/* -------------------------------------------------------------------------- */
/*                  CHECK PASSWORD STRENGTH INPUT                              */
/* -------------------------------------------------------------------------- */

export const passwordStrengthSchema = z.object({
  password: z.string().min(1, "A senha é obrigatória."),
});

export type PasswordStrengthInput = z.infer<typeof passwordStrengthSchema>;
