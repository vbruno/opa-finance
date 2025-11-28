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

export async function authRoutes(app: FastifyInstance) {
  const service = new AuthService(app, app.db);

  // Registro
  app.post("/auth/register", async (req, reply) => {
    try {
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
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  });

  // Login
  app.post("/auth/login", async (req, reply) => {
    try {
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
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  });

  // Refresh Token
  app.post("/auth/refresh", async (req, reply) => {
    try {
      const payload = await req.jwtVerify<{ sub: string }>({ onlyCookie: true });

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
    } catch {
      return reply.status(401).send({ message: "Invalid refresh token" });
    }
  });

  // /me
  app.get("/auth/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const userId = req.user.sub;

      const [user] = await app.db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return reply.status(404).send({ message: "Usuário não encontrado." });
      }

      // remove passwordHash do retorno
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...publicUser } = user;

      return reply.send(publicUser);
    } catch {
      return reply.status(401).send({ message: "Token inválido." });
    }
  });

  // Logout
  app.post("/auth/logout", async (req, reply) => {
    reply.clearCookie("refreshToken", {
      path: "/",
    });

    return reply.status(200).send({
      message: "Logout realizado com sucesso.",
    });
  });

  // Check Password Strength
  app.post("/auth/check-password-strength", async (req, reply) => {
    try {
      const { password } = passwordStrengthSchema.parse(req.body);
      const strength = getPasswordStrength(password);
      return reply.send({ strength });
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  });

  // Change Password
  app.post("/auth/change-password", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const data = changePasswordSchema.parse(req.body);
      const userId = req.user.sub;

      const result = await service.changePassword(userId, data);

      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  });

  // Forgot Password
  app.post("/auth/forgot-password", async (req, reply) => {
    try {
      const data = forgotPasswordSchema.parse(req.body);

      const result = await service.forgotPassword(data.email);

      return reply.send({
        message: "Se o email existir, enviaremos um link de redefinição.",
        resetToken: result.resetToken,
      });
    } catch {
      return reply.send({
        message: "Se o email existir, enviaremos um link de redefinição.",
      });
    }
  });

  // Reset Password
  app.post("/auth/reset-password", async (req, reply) => {
    try {
      const data = resetPasswordSchema.parse(req.body);

      const result = await service.resetPassword(data);

      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  });
}
