import { z } from "zod";

// 📌 Schema público (retorno seguro)
export const publicUserSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
  createdAt: z.date().optional(),
});

// 📌 GET /users/:id
export const getUserParamsSchema = z.object({
  id: z.uuid(),
});
export type GetUserParams = z.infer<typeof getUserParamsSchema>;

// 📌 GET /users (listagem)
export const listUsersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => Number(v) || 1),
  limit: z
    .string()
    .optional()
    .transform((v) => Number(v) || 10),
  name: z.string().optional(),
  email: z.string().optional(), // filtro opcional
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

// 📌 PUT /users/:id — atualizar
export const updateUserParamsSchema = z.object({
  id: z.uuid(),
});

export const updateUserBodySchema = z
  .object({
    name: z.string().min(3).max(255).optional(),
    email: z.email().max(255).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Pelo menos um campo deve ser atualizado.",
  });

export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type UpdateUserParams = z.infer<typeof updateUserParamsSchema>;

// 📌 DELETE /users/:id
export const deleteUserParamsSchema = z.object({
  id: z.uuid(),
});
export type DeleteUserParams = z.infer<typeof deleteUserParamsSchema>;
