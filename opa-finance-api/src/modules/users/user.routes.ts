// src/modules/users/user.routes.ts
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

  // LIST USERS
  app.get("/users", { preHandler: [app.authenticate] }, async (req) => {
    const query = listUsersQuerySchema.parse(req.query);
    return await service.list(query);
  });

  // GET ONE
  app.get("/users/:id", { preHandler: [app.authenticate] }, async (req) => {
    const params = getUserParamsSchema.parse(req.params);
    return await service.getOne(params);
  });

  // UPDATE
  app.put("/users/:id", { preHandler: [app.authenticate] }, async (req) => {
    const params = updateUserParamsSchema.parse(req.params);
    const body = updateUserBodySchema.parse(req.body);

    // Não verifica autorização aqui! O service faz isso.
    return await service.update(params, body, req.user.sub);
  });

  // DELETE /users/:id
  app.delete("/users/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const params = deleteUserParamsSchema.parse(req.params);

    // passar corretamente ao service
    const result = await service.delete(params, req.user.sub);

    return reply.status(200).send(result);
  });
}
