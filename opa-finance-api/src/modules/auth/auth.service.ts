// src/modules/auth/auth.service.ts
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { env } from "../../core/config/env";
import {
  ConflictProblem,
  UnauthorizedProblem,
  NotFoundProblem,
  ValidationProblem,
} from "../../core/errors/problems";
import type { DB } from "../../core/plugins/drizzle";
import { hashPassword, comparePassword } from "../../core/utils/hash.utils";
import { users } from "../../db/schema";

import type { RegisterInput, LoginInput } from "./auth.schemas";
import type { ChangePasswordInput, ResetPasswordInput } from "./password.schemas";

export class AuthService {
  constructor(
    private app: FastifyInstance,
    private db: DB,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                                 REGISTER                                   */
  /* -------------------------------------------------------------------------- */
  async register(data: RegisterInput) {
    const { confirmPassword, ...userData } = data;
    void confirmPassword;

    const exists = await this.db
      .select()
      .from(users)
      .where(eq(users.email, userData.email))
      .limit(1);

    if (exists.length > 0) {
      throw new ConflictProblem("E-mail já cadastrado.", "/auth/register");
    }

    const passwordHash = await hashPassword(userData.password);

    const [user] = await this.db
      .insert(users)
      .values({
        name: userData.name,
        email: userData.email,
        passwordHash,
      })
      .returning();

    return user;
  }

  /* -------------------------------------------------------------------------- */
  /*                                   LOGIN                                    */
  /* -------------------------------------------------------------------------- */
  async login(data: LoginInput) {
    const [user] = await this.db.select().from(users).where(eq(users.email, data.email)).limit(1);

    if (!user) {
      throw new UnauthorizedProblem("Credenciais inválidas.", "/auth/login");
    }

    const valid = await comparePassword(data.password, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedProblem("Credenciais inválidas.", "/auth/login");
    }

    return user;
  }

  /* -------------------------------------------------------------------------- */
  /*                         TOKEN GENERATION                                   */
  /* -------------------------------------------------------------------------- */
  generateAccessToken(userId: string) {
    return this.app.jwt.sign({ sub: userId }, { expiresIn: "15m" });
  }

  generateRefreshToken(userId: string) {
    return this.app.jwt.sign(
      { sub: userId },
      { expiresIn: "7d", secret: env.REFRESH_TOKEN_SECRET },
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                             CHANGE PASSWORD                                */
  /* -------------------------------------------------------------------------- */
  async changePassword(userId: string, data: ChangePasswordInput) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      throw new NotFoundProblem("Usuário não encontrado.", "/auth/change-password");
    }

    const valid = await comparePassword(data.currentPassword, user.passwordHash);

    if (!valid) {
      throw new ValidationProblem("Senha atual incorreta.", "/auth/change-password");
    }

    const newHash = await hashPassword(data.newPassword);

    await this.db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));

    return { message: "Senha alterada com sucesso." };
  }

  /* -------------------------------------------------------------------------- */
  /*                             FORGOT PASSWORD                                */
  /* -------------------------------------------------------------------------- */
  async forgotPassword(email: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);

    // ❗ Se o usuário não existir, retorna como se existisse
    if (!user) {
      return {
        resetToken: undefined,
        email,
      };
    }

    const token = this.app.jwt.sign({ sub: user.id, type: "reset" }, { expiresIn: "15m" });

    return { resetToken: token, email: user.email };
  }

  /* -------------------------------------------------------------------------- */
  /*                              RESET PASSWORD                                */
  /* -------------------------------------------------------------------------- */
  async resetPassword(data: ResetPasswordInput) {
    let payload: unknown;

    try {
      payload = this.app.jwt.verify(data.token);
    } catch {
      throw new ValidationProblem("Token inválido ou expirado.", "/auth/reset-password");
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      !("type" in payload) ||
      (payload as any).type !== "reset"
    ) {
      throw new ValidationProblem("Token inválido.", "/auth/reset-password");
    }

    const userId = (payload as any).sub;

    const [user] = await this.db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      throw new NotFoundProblem("Usuário não encontrado.", "/auth/reset-password");
    }

    const newHash = await hashPassword(data.newPassword);

    await this.db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));

    return { message: "Senha redefinida com sucesso." };
  }
}
