import { FastifyInstance } from "fastify";
import { createAccountSchema, updateAccountSchema, accountParamsSchema } from "./account.schemas";
import { AccountService } from "./account.service";

export async function accountRoutes(app: FastifyInstance) {
  const service = new AccountService(app);

  // Criar conta
  app.post("/accounts", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const body = createAccountSchema.parse(req.body);
      const account = await service.create(req.user.sub, body);

      return reply.status(201).send(account);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  });

  // Listar contas do usuário
  app.get("/accounts", { preHandler: [app.authenticate] }, async (req) => {
    return await service.list(req.user.sub);
  });

  // Obter conta específica
  app.get("/accounts/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const params = accountParamsSchema.parse(req.params);

      const account = await service.getOne(params.id, req.user.sub);
      return reply.send(account);
    } catch (err: any) {
      if (err.message === "Conta não encontrada.")
        return reply.status(404).send({ message: err.message });
      if (err.message === "Acesso negado.") return reply.status(403).send({ message: err.message });
      return reply.status(400).send({ message: err.message });
    }
  });

  // Atualizar conta
  app.put("/accounts/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const params = accountParamsSchema.parse(req.params);
      const body = updateAccountSchema.parse(req.body);

      const updated = await service.update(params.id, req.user.sub, body);
      return reply.send(updated);
    } catch (err: any) {
      if (err.message === "Conta não encontrada.")
        return reply.status(404).send({ message: err.message });
      if (err.message === "Acesso negado.") return reply.status(403).send({ message: err.message });
      return reply.status(400).send({ message: err.message });
    }
  });

  // Remover conta
  app.delete("/accounts/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const params = accountParamsSchema.parse(req.params);

      const result = await service.delete(params.id, req.user.sub);
      return reply.send(result);
    } catch (err: any) {
      if (err.message === "Conta não encontrada.")
        return reply.status(404).send({ message: err.message });

      if (err.message === "Acesso negado.") return reply.status(403).send({ message: err.message });

      if (err.message.includes("transações"))
        return reply.status(409).send({ message: err.message });

      return reply.status(400).send({ message: err.message });
    }
  });
}
