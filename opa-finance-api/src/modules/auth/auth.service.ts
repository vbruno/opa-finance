import { eq } from "drizzle-orm";
import { db } from "../../core/plugins/drizzle";
import { hashPassword } from "../../core/utils/hash";
import { comparePassword } from "../../core/utils/hash";
import { users } from "../../db/schema";
import type { RegisterInput } from "./auth.schemas";
import type { LoginInput } from "./auth.schemas";

export class AuthService {
  async register(data: RegisterInput) {
    // verificar se email já existe
    const existing = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

    if (existing.length > 0) {
      throw new Error("E-mail já cadastrado.");
    }

    const passwordHash = await hashPassword(data.password);

    const [user] = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        passwordHash,
      })
      .returning();

    return user;
  }

  async login(data: LoginInput) {
    const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

    if (!user) {
      throw new Error("Credenciais inválidas.");
    }

    const valid = await comparePassword(data.password, user.passwordHash);

    if (!valid) {
      throw new Error("Credenciais inválidas.");
    }

    return user;
  }
}
