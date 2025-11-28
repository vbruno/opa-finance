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

  // -------------------- LIST USERS --------------------
  app.get("/users", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const query = listUsersQuerySchema.parse(req.query);
      return reply.send(await service.list(query));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  });

  // -------------------- GET BY ID --------------------
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

  // -------------------- UPDATE --------------------
  app.put("/users/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const params = updateUserParamsSchema.parse(req.params);
      const body = updateUserBodySchema.parse(req.body);

      const existing = await service.getOne(params);

      if (!existing) {
        return reply.status(404).send({ message: "Usuário não encontrado." });
      }

      if (params.id !== req.user.sub) {
        return reply.status(403).send({ message: "Você não pode atualizar este usuário." });
      }

      const updated = await service.update(params, body);

      return reply.send(updated);
    } catch (err: any) {
      if (err.message === "Usuário não encontrado.") {
        return reply.status(404).send({ message: err.message });
      }

      return reply.status(400).send({ message: err.message });
    }
  });

  // -------------------- DELETE --------------------
  app.delete("/users/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const params = deleteUserParamsSchema.parse(req.params);

      // 1️⃣ Buscar usuário primeiro
      const existing = await service.getOne(params);

      // 2️⃣ Se não existir → 404
      if (!existing) {
        return reply.status(404).send({ message: "Usuário não encontrado." });
      }

      // 3️⃣ Permissão (só pode deletar o próprio usuário)
      if (params.id !== req.user.sub) {
        return reply.status(403).send({ message: "Você não pode remover este usuário." });
      }

      // 4️⃣ Remover
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
