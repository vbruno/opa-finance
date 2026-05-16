// src/modules/auth/auth.service.ts
import { randomBytes } from "node:crypto";

import { and, eq, gt, isNull, ne } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { env } from "../../core/config/env";
import {
  ConflictProblem,
  UnauthorizedProblem,
  NotFoundProblem,
  ValidationProblem,
} from "../../core/errors/problems";
import type { DB } from "../../core/plugins/drizzle";
import {
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
} from "../../core/services/email.service";
import { hashPassword, comparePassword } from "../../core/utils/hash.utils";
import { ensureValidTimezone } from "../../core/utils/timezone-db.utils";
import { DEFAULT_TIMEZONE } from "../../core/utils/timezone.utils";
import { passwordResetTokens, users } from "../../db/schema";

import type { RegisterInput, LoginInput } from "./auth.schemas";
import { RESET_TOKEN_TTL_MINUTES, buildResetLink, hashResetToken } from "./password-reset.utils";
import type { ChangePasswordInput, ResetPasswordInput } from "./password.schemas";

type ForgotPasswordResult = {
  email: string;
};

function formatChangedAt(timezone: string, when: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone,
  }).format(when);
}

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
    const timezone = (userData.timezone ?? DEFAULT_TIMEZONE).trim();
    await ensureValidTimezone(this.db, timezone, "/auth/register");

    const [user] = await this.db
      .insert(users)
      .values({
        name: userData.name,
        email: userData.email,
        timezone,
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
    return this.app.jwt.sign({ sub: userId }, { expiresIn: "7d", key: env.REFRESH_TOKEN_SECRET });
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
  async forgotPassword(email: string, requesterIp?: string): Promise<ForgotPasswordResult> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);

    // Resposta sempre genérica — não revelamos se o email existe.
    if (!user) {
      return { email };
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);

    await this.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
      requesterIp: requesterIp ?? null,
    });

    const resetLink = buildResetLink(env.APP_BASE_URL, rawToken);

    await sendPasswordResetEmail({
      to: user.email,
      userName: user.name,
      resetLink,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      logger: this.app.log,
    });

    return { email: user.email };
  }

  /* -------------------------------------------------------------------------- */
  /*                       VALIDATE RESET TOKEN (read-only)                     */
  /* -------------------------------------------------------------------------- */
  async validateResetToken(token: string): Promise<{ valid: boolean }> {
    const tokenHash = hashResetToken(token);
    const [row] = await this.db
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    return { valid: Boolean(row) };
  }

  /* -------------------------------------------------------------------------- */
  /*                              RESET PASSWORD                                */
  /* -------------------------------------------------------------------------- */
  async resetPassword(data: ResetPasswordInput, requesterIp?: string) {
    const tokenHash = hashResetToken(data.token);
    const now = new Date();

    const [tokenRow] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .limit(1);

    if (!tokenRow) {
      throw new ValidationProblem("Token inválido ou expirado.", "/auth/reset-password");
    }

    const [user] = await this.db.select().from(users).where(eq(users.id, tokenRow.userId));

    if (!user) {
      throw new NotFoundProblem("Usuário não encontrado.", "/auth/reset-password");
    }

    const newHash = await hashPassword(data.newPassword);

    await this.db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

    // Marca o token como usado de forma atômica — defesa contra race condition.
    const consumed = await this.db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokens.id, tokenRow.id), isNull(passwordResetTokens.usedAt)))
      .returning({ id: passwordResetTokens.id });

    if (consumed.length === 0) {
      throw new ValidationProblem("Token já utilizado.", "/auth/reset-password");
    }

    // Invalida quaisquer outros tokens ativos do mesmo usuário.
    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          isNull(passwordResetTokens.usedAt),
          ne(passwordResetTokens.id, tokenRow.id),
        ),
      );

    await sendPasswordChangedEmail({
      to: user.email,
      userName: user.name,
      changedAtFormatted: formatChangedAt(user.timezone, now),
      ip: requesterIp ?? null,
      logger: this.app.log,
    });

    return { message: "Senha redefinida com sucesso." };
  }
}
