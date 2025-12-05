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

export class UserService {
  constructor(private app: FastifyInstance) {}

  // 📌 Buscar 1 usuário por ID
  async getOne(params: GetUserParams) {
    const [user]: (typeof users.$inferSelect)[] = await this.app.db
      .select()
      .from(users)
      .where(eq(users.id, params.id));

    if (!user) {
      throw new NotFoundProblem("Usuário não encontrado.");
    }

    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }

  // 📌 Listar usuários com paginação + filtros
  async list(query: ListUsersQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const filters = [];

    if (query.name) {
      filters.push(ilike(users.name, `%${query.name}%`));
    }

    if (query.email) {
      filters.push(ilike(users.email, `%${query.email}%`));
    }

    const rows: (typeof users.$inferSelect)[] = await this.app.db
      .select()
      .from(users)
      .where(filters.length ? and(...filters) : undefined)
      .limit(limit)
      .offset(offset);

    const sanitized = rows.map(({ passwordHash: _passwordHash, ...user }) => user);

    return {
      data: sanitized,
      page,
      limit,
    };
  }

  // 📌 Atualizar usuário
  async update(params: UpdateUserParams, body: UpdateUserBody, authUserId: string) {
    // 1. Verifica existência
    const [exists] = await this.app.db.select().from(users).where(eq(users.id, params.id));

    if (!exists) {
      throw new NotFoundProblem("Usuário não encontrado.");
    }

    // 2. Verifica autorização
    if (exists.id !== authUserId) {
      throw new ForbiddenProblem("Você não pode atualizar este usuário.");
    }

    // 3. Atualiza
    const [updated] = await this.app.db
      .update(users)
      .set(body)
      .where(eq(users.id, params.id))
      .returning();

    const { passwordHash, ...publicUser } = updated;
    return publicUser;
  }

  // 📌 Remover usuário
  async delete(params: DeleteUserParams, authUserId: string) {
    const [exists] = await this.app.db.select().from(users).where(eq(users.id, params.id));

    if (!exists) {
      throw new NotFoundProblem("Usuário não encontrado.");
    }

    if (exists.id !== authUserId) {
      throw new ForbiddenProblem("Você não pode remover este usuário.");
    }

    await this.app.db.delete(users).where(eq(users.id, params.id));

    return { message: "Usuário removido com sucesso." };
  }
}
