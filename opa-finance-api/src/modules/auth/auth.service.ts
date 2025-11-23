import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify/types/instance";
import { db } from "../../core/plugins/drizzle";
import { hashPassword } from "../../core/utils/hash";
import { comparePassword } from "../../core/utils/hash";
import { users } from "../../db/schema";
import type { RegisterInput } from "./auth.schemas";
import type { LoginInput } from "./auth.schemas";

export class AuthService {
  constructor(private app: FastifyInstance) {}

  async register(data: RegisterInput) {
    const { confirmPassword, ...userData } = data;
    // verificar se email já existe
    const exists = await db.select().from(users).where(eq(users.email, userData.email)).limit(1);

    if (exists.length > 0) {
      throw new Error("E-mail já cadastrado.");
    }

    const passwordHash = await hashPassword(userData.password);

    const [user] = await db
      .insert(users)
      .values({
        name: userData.name,
        email: userData.email,
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

  generateAccessToken(userId: string) {
    return this.app.jwt.sign({ sub: userId }, { expiresIn: "15m" });
  }

  generateRefreshToken(userId: string) {
    return this.app.jwt.sign({ sub: userId }, { expiresIn: "7d" });
  }
}
