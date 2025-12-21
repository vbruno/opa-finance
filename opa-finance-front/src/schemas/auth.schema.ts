import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z.string().min(1, 'Senha é obrigatória'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(3, 'Nome deve ter no mínimo 3 caracteres')
      .max(255, 'Nome muito longo'),
    email: z
      .string()
      .min(1, 'Email é obrigatório')
      .email('Email inválido')
      .max(255, 'Email muito longo'),
    password: z
      .string()
      .min(8, 'Senha deve ter no mínimo 8 caracteres')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Senha deve conter maiúscula, minúscula, número e caractere especial',
      ),
    confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

export type RegisterFormData = z.infer<typeof registerSchema>
