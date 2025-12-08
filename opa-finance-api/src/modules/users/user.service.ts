// src/modules/users/user.service.ts
import { eq, ilike, and } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import type {
  ListUsersQuery,
  UpdateUserBody,
  UpdateUserParams,
  DeleteUserParams,
  GetUserParams,
} from "./user.schemas";

import { ForbiddenProblem, NotFoundProblem } from "@/core/errors/problems";
import { users } from "@/db/schema";

type UserRow = typeof users.$inferSelect;

export class UserService {
  constructor(private app: FastifyInstance) {}

  /* ---------------------------------- GET ONE --------------------------------- */
  async getOne(params: GetUserParams) {
    const result = await this.app.db.select().from(users).where(eq(users.id, params.id));
    const [user] = result as UserRow[];

    if (!user) {
      throw new NotFoundProblem("Usuário não encontrado.", `/users/${params.id}`);
    }

    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }

  /* ---------------------------------- LIST ----------------------------------- */
  async list(query: ListUsersQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const filters = [];

    if (query.name) filters.push(ilike(users.name, `%${query.name}%`));
    if (query.email) filters.push(ilike(users.email, `%${query.email}%`));

    const result = await this.app.db
      .select()
      .from(users)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .limit(limit)
      .offset(offset);

    const rows = result as UserRow[];

    const sanitized = rows.map(({ passwordHash: _passwordHash, ...u }) => u);

    return { data: sanitized, page, limit };
  }

  /* ---------------------------------- UPDATE ---------------------------------- */
  async update(params: UpdateUserParams, body: UpdateUserBody, authUserId: string) {
    const existingResult = await this.app.db.select().from(users).where(eq(users.id, params.id));
    const [exists] = existingResult as UserRow[];

    if (!exists) {
      throw new NotFoundProblem("Usuário não encontrado.", `/users/${params.id}`);
    }

    if (exists.id !== authUserId) {
      throw new ForbiddenProblem("Você não pode atualizar este usuário.", `/users/${params.id}`);
    }

    const updatedResult = await this.app.db
      .update(users)
      .set(body)
      .where(eq(users.id, params.id))
      .returning();

    const [updated] = updatedResult as UserRow[];

    const { passwordHash: _passwordHash, ...publicUser } = updated;
    return publicUser;
  }

  /* ---------------------------------- DELETE ---------------------------------- */
  async delete(params: DeleteUserParams, authUserId: string) {
    const existingResult = await this.app.db.select().from(users).where(eq(users.id, params.id));
    const [exists] = existingResult as UserRow[];

    if (!exists) {
      throw new NotFoundProblem("Usuário não encontrado.", `/users/${params.id}`);
    }

    if (exists.id !== authUserId) {
      throw new ForbiddenProblem("Você não pode remover este usuário.", `/users/${params.id}`);
    }

    await this.app.db.delete(users).where(eq(users.id, params.id));

    return { message: "Usuário removido com sucesso." };
  }
}
