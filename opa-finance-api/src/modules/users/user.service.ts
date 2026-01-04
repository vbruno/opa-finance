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
  async getOne(params: GetUserParams, authUserId: string) {
    const result = await this.app.db.select().from(users).where(eq(users.id, params.id));
    const [user] = result as UserRow[];

    if (!user) {
      throw new NotFoundProblem("Usuário não encontrado.", `/users/${params.id}`);
    }

    if (user.id !== authUserId) {
      throw new ForbiddenProblem("Você não pode acessar este usuário.", `/users/${params.id}`);
    }

    const { passwordHash, ...publicUser } = user;
    void passwordHash;
    return publicUser;
  }

  /* ---------------------------------- LIST ----------------------------------- */
  async list(query: ListUsersQuery, authUserId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const result = await this.app.db.select().from(users).where(eq(users.id, authUserId));
    const [user] = result as UserRow[];

    if (!user) {
      throw new NotFoundProblem("Usuário não encontrado.", `/users/${authUserId}`);
    }

    if (query.name) {
      const matches = user.name.toLowerCase().includes(query.name.toLowerCase());
      if (!matches) return { data: [], page, limit };
    }

    if (query.email) {
      const matches = user.email.toLowerCase().includes(query.email.toLowerCase());
      if (!matches) return { data: [], page, limit };
    }

    const { passwordHash, ...publicUser } = user;
    void passwordHash;

    return { data: [publicUser], page, limit };
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

    const { passwordHash, ...publicUser } = updated;
    void passwordHash;
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
