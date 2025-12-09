// src/modules/accounts/account.routes.ts
import { FastifyInstance } from "fastify";
import { createAccountSchema, updateAccountSchema, accountParamsSchema } from "./account.schemas";
import { AccountService } from "./account.service";

export async function accountRoutes(app: FastifyInstance) {
  const service = new AccountService(app);

  /* -------------------------------------------------------------------------- */
  /*                                   CREATE                                   */
  /* -------------------------------------------------------------------------- */
  app.post("/accounts", { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = createAccountSchema.parse(req.body);
    const account = await service.create(req.user.sub, body);
    return reply.status(201).send(account);
  });

  /* -------------------------------------------------------------------------- */
  /*                                    LIST                                    */
  /* -------------------------------------------------------------------------- */
  app.get("/accounts", { preHandler: [app.authenticate] }, async (req) => {
    return await service.list(req.user.sub);
  });

  /* -------------------------------------------------------------------------- */
  /*                                   GET ONE                                  */
  /* -------------------------------------------------------------------------- */
  app.get("/accounts/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = accountParamsSchema.parse(req.params);
    return await service.getOne(id, req.user.sub);
  });

  /* -------------------------------------------------------------------------- */
  /*                                   UPDATE                                   */
  /* -------------------------------------------------------------------------- */
  app.put("/accounts/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = accountParamsSchema.parse(req.params);
    const body = updateAccountSchema.parse(req.body);
    return await service.update(id, req.user.sub, body);
  });

  /* -------------------------------------------------------------------------- */
  /*                                   DELETE                                   */
  /* -------------------------------------------------------------------------- */
  app.delete("/accounts/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = accountParamsSchema.parse(req.params);
    return await service.delete(id, req.user.sub);
  });
}
