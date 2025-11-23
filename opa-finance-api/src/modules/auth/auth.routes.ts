import { FastifyInstance } from "fastify";
import { getPasswordStrength } from "../../core/utils/passwords.utils";
import { registerSchema, loginSchema } from "./auth.schemas";
import { AuthService } from "./auth.service";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./password.schemas";

export async function authRoutes(app: FastifyInstance) {
  const service = new AuthService(app);

  // Registro
  app.post("/auth/register", async (req, reply) => {
    const data = registerSchema.parse(req.body);

    const user = await service.register(data);

    const accessToken = service.generateAccessToken(user.id);
    const refreshToken = service.generateRefreshToken(user.id);

    // set cookie do refresh token
    reply.setCookie("refreshToken", refreshToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7,
    });

    return reply.status(201).send({ accessToken });
  });

  // Login
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
  app.get("/auth/me", { preHandler: [app.authenticate] }, async (req) => {
    return { userId: req.user.sub };
  });

  // Logout
  app.post("/auth/logout", async (_, reply) => {
    reply.clearCookie("refreshToken");
    return { message: "Logged out" };
  });

  // Check Password Strength
  app.post("/auth/check-password-strength", async (req) => {
    const { password } = req.body as { password: string };
    return { strength: getPasswordStrength(password) };
  });

  // Change Password
  app.post("/auth/change-password", { preHandler: [app.authenticate] }, async (req, reply) => {
    const data = changePasswordSchema.parse(req.body);
    const userId = req.user.sub;

    const result = await service.changePassword(userId, data);

    return reply.send(result);
  });

  // Forgot Password
  app.post("/auth/forgot-password", async (req, reply) => {
    const data = forgotPasswordSchema.parse(req.body);

    const result = await service.forgotPassword(data.email);

    return reply.send({
      message: "Se o email existir, enviaremos um link de redefinição.",
      resetToken: result.resetToken, // para debug, remova em produção
    });
  });

  // Reset Password
  app.post("/auth/reset-password", async (req, reply) => {
    const data = resetPasswordSchema.parse(req.body);

    const result = await service.resetPassword(data);

    return reply.send(result);
  });
}
