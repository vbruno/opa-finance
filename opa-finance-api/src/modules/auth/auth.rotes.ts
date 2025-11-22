import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "./auth.schemas";
import { AuthService } from "./auth.service";

export async function authRoutes(app: FastifyInstance) {
  const service = new AuthService();

  app.post(
    "/auth/register",
    async (req: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply) => {
      const data = registerSchema.parse(req.body);

      const user = await service.register(data);

      return reply.status(201).send({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      });
    },
  );

  app.post("/auth/login", async (req: FastifyRequest<{ Body: LoginInput }>) => {
    const data = loginSchema.parse(req.body);

    const user = await service.login(data);

    const token = app.jwt.sign({ sub: user.id });

    return { token };
  });
}
