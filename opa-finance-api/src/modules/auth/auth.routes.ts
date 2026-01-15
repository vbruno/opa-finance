// src/modules/auth/auth.routes.ts
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { getPasswordStrength } from "../../core/utils/passwords.utils";
import { users } from "../../db/schema";

import { registerSchema, loginSchema } from "./auth.schemas";
import { AuthService } from "./auth.service";

import {
  changePasswordSchema,
  forgotPasswordSchema,
  passwordStrengthSchema,
  resetPasswordSchema,
} from "./password.schemas";

import { env } from "@/core/config/env";
import { NotFoundProblem, UnauthorizedProblem } from "@/core/errors/problems";

export async function authRoutes(app: FastifyInstance) {
  const service = new AuthService(app, app.db);

  /* -------------------------------------------------------------------------- */
  /*                                   REGISTER                                 */
  /* -------------------------------------------------------------------------- */
  app.post("/auth/register", async (req, reply) => {
    const data = registerSchema.parse(req.body);

    const user = await service.register(data);

    const accessToken = service.generateAccessToken(user.id);
    const refreshToken = service.generateRefreshToken(user.id);

    reply.setCookie("refreshToken", refreshToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7,
    });

    return reply.status(201).send({ accessToken });
  });

  /* -------------------------------------------------------------------------- */
  /*                                     LOGIN                                  */
  /* -------------------------------------------------------------------------- */
  app.post("/auth/login", async (req, reply) => {
    const data = loginSchema.parse(req.body);
    const user = await service.login(data);

    const accessToken = service.generateAccessToken(user.id);
    const refreshToken = service.generateRefreshToken(user.id);

    reply.setCookie("refreshToken", refreshToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7,
    });

    return { accessToken };
  });

  /* -------------------------------------------------------------------------- */
  /*                               REFRESH TOKEN                                */
  /* -------------------------------------------------------------------------- */
  app.post("/auth/refresh", async (req, reply) => {
    let payload: { sub: string };

    try {
      payload = await req.jwtVerify<{ sub: string }>({
        onlyCookie: true,
        secret: env.REFRESH_TOKEN_SECRET,
      });
    } catch {
      throw new UnauthorizedProblem("Invalid refresh token", req.url);
    }

    const accessToken = service.generateAccessToken(payload.sub);
    const refreshToken = service.generateRefreshToken(payload.sub);

    reply.setCookie("refreshToken", refreshToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7,
    });

    return { accessToken };
  });

  /* -------------------------------------------------------------------------- */
  /*                                      ME                                    */
  /* -------------------------------------------------------------------------- */
  app.get("/auth/me", { preHandler: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;

    const [user] = await app.db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      throw new NotFoundProblem("Usuário não encontrado", req.url);
    }

    const { passwordHash, ...publicUser } = user;
    void passwordHash;
    return publicUser;
  });

  /* -------------------------------------------------------------------------- */
  /*                                     LOGOUT                                 */
  /* -------------------------------------------------------------------------- */
  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie("refreshToken", { path: "/" });
    return reply.status(200).send({ message: "Logout realizado com sucesso." });
  });

  /* -------------------------------------------------------------------------- */
  /*                          CHECK PASSWORD STRENGTH                           */
  /* -------------------------------------------------------------------------- */
  app.post("/auth/check-password-strength", async (req) => {
    const { password } = passwordStrengthSchema.parse(req.body);
    return { strength: getPasswordStrength(password) };
  });

  /* -------------------------------------------------------------------------- */
  /*                             CHANGE PASSWORD                                */
  /* -------------------------------------------------------------------------- */
  app.post("/auth/change-password", { preHandler: [app.authenticate] }, async (req) => {
    const data = changePasswordSchema.parse(req.body);

    return await service.changePassword(req.user.sub, data);
  });

  /* -------------------------------------------------------------------------- */
  /*                              FORGOT PASSWORD                               */
  /* -------------------------------------------------------------------------- */
  app.post("/auth/forgot-password", async (req) => {
    const { email } = forgotPasswordSchema.parse(req.body);

    const result = await service.forgotPassword(email);
    // TODO: enviar o token por e-mail em producao.
    const includeToken = env.NODE_ENV !== "production";

    return {
      message: "Se o email existir, enviaremos um link de redefinição.",
      ...(includeToken ? { resetToken: result.resetToken } : {}),
    };
  });

  /* -------------------------------------------------------------------------- */
  /*                               RESET PASSWORD                               */
  /* -------------------------------------------------------------------------- */
  app.post("/auth/reset-password", async (req) => {
    const data = resetPasswordSchema.parse(req.body);
    return await service.resetPassword(data);
  });
}
