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

  /* ---------------------------------- LIST ---------------------------------- */
  app.get("/users", { preHandler: [app.authenticate] }, async (req) => {
    const query = listUsersQuerySchema.parse(req.query);
    return service.list(query);
  });

  /* ---------------------------------- GET ONE -------------------------------- */
  app.get("/users/:id", { preHandler: [app.authenticate] }, async (req) => {
    const params = getUserParamsSchema.parse(req.params);
    return service.getOne(params);
  });

  /* ---------------------------------- UPDATE --------------------------------- */
  app.put("/users/:id", { preHandler: [app.authenticate] }, async (req) => {
    const params = updateUserParamsSchema.parse(req.params);
    const body = updateUserBodySchema.parse(req.body);
    return service.update(params, body, req.user.sub);
  });

  /* ---------------------------------- DELETE --------------------------------- */
  app.delete("/users/:id", { preHandler: [app.authenticate] }, async (req) => {
    const params = deleteUserParamsSchema.parse(req.params);
    return service.delete(params, req.user.sub);
  });
}
