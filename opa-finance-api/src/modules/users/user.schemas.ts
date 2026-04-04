import { z } from "zod";

// 📌 Schema público (retorno seguro)
export const publicUserSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
  timezone: z.string(),
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
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});

export type UpdateUserParams = z.infer<typeof updateUserParamsSchema>;

export const updateUserBodySchema = z
  .object({
    name: z.string().min(3).max(255).optional(),
    email: z.email().max(255).optional(),
    timezone: z.string().optional(),
  })
  .refine(
    (body) => {
      return body.name !== undefined || body.email !== undefined || body.timezone !== undefined;
    },
    {
      message: "Pelo menos um campo deve ser atualizado.",
    },
  );

export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;

// 📌 DELETE /users/:id
export const deleteUserParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type DeleteUserParams = z.infer<typeof deleteUserParamsSchema>;
