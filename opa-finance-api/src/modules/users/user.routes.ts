import { FastifyInstance } from "fastify";
import {
  getUserParamsSchema,
  listUsersQuerySchema,
  updateUserBodySchema,
  updateUserParamsSchema,
  deleteUserParamsSchema,
} from "./user.schemas";
import { UserService } from "./user.service";

export async function userRoutes(app: FastifyInstance) {
  const service = new UserService(app);

  // 🔹 GET /users – listar usuários (protegido)
  app.get("/users", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const query = listUsersQuerySchema.parse(req.query);

      const result = await service.list(query);

      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  });

  // 🔹 GET /users/:id – buscar usuário por ID (protegido)
  app.get("/users/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const params = getUserParamsSchema.parse(req.params);

      const user = await service.getOne(params);

      return reply.send(user);
    } catch (err: any) {
      if (err.message === "Usuário não encontrado.") {
        return reply.status(404).send({ message: err.message });
      }

      return reply.status(400).send({ message: err.message });
    }
  });

  // 🔹 PUT /users/:id – atualizar usuário (protegido, só o próprio)
  app.put("/users/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const params = updateUserParamsSchema.parse(req.params);
      const body = updateUserBodySchema.parse(req.body);

      // só pode atualizar a si mesmo
      if (params.id !== req.user.sub) {
        return reply.status(403).send({ message: "Você não pode atualizar este usuário." });
      }

      const user = await service.update(params, body);

      return reply.send(user);
    } catch (err: any) {
      if (err.message === "Usuário não encontrado.") {
        return reply.status(404).send({ message: err.message });
      }

      return reply.status(400).send({ message: err.message });
    }
  });

  // 🔹 DELETE /users/:id – remover usuário (protegido, só o próprio)
  app.delete("/users/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const params = deleteUserParamsSchema.parse(req.params);

      if (params.id !== req.user.sub) {
        return reply.status(403).send({ message: "Você não pode remover este usuário." });
      }

      const result = await service.delete(params);

      return reply.send(result);
    } catch (err: any) {
      if (err.message === "Usuário não encontrado.") {
        return reply.status(404).send({ message: err.message });
      }

      return reply.status(400).send({ message: err.message });
    }
  });
}
