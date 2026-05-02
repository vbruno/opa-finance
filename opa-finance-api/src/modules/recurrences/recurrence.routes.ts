import { FastifyInstance } from "fastify";
import {
  createRecurrenceSchema,
  confirmRecurrenceOccurrenceSchema,
  editRecurrenceByScopeSchema,
  listRecurrencesQuerySchema,
  materializeRecurrencesSchema,
  recurrencesForecastQuerySchema,
  recurrenceOccurrenceParamsSchema,
  recurrenceTimelineQuerySchema,
  recurrenceParamsSchema,
  skipRecurrenceOccurrenceSchema,
  updateRecurrenceSchema,
} from "./recurrence.schemas";
import { RecurrenceService } from "./recurrence.service";

export async function recurrenceRoutes(app: FastifyInstance) {
  const service = new RecurrenceService(app);
  const recurrenceTag = ["Recurrences"];

  app.post(
    "/recurrences",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: recurrenceTag,
        summary: "Criar recorrência",
        description: "Cria uma regra de recorrência para transação ou transferência.",
        security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      const body = createRecurrenceSchema.parse(req.body);
      const recurrence = await service.create(req.user.sub, body);
      return reply.status(201).send(recurrence);
    },
  );

  app.get(
    "/recurrences",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: recurrenceTag,
        summary: "Listar recorrências",
        description: "Lista recorrências do usuário com paginação e filtros.",
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const query = listRecurrencesQuerySchema.parse(req.query);
      return service.list(req.user.sub, query);
    },
  );

  app.get(
    "/recurrences/forecast",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: recurrenceTag,
        summary: "Forecast de recorrências",
        description:
          "Projeta recorrências até o fim do ano solicitado separando valores reais e projetados.",
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const query = recurrencesForecastQuerySchema.parse(req.query);
      return service.forecast(req.user.sub, query);
    },
  );

  app.get(
    "/recurrences/:id/timeline",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: recurrenceTag,
        summary: "Listar timeline de recorrência",
        description:
          "Retorna ocorrências persistidas e projetadas de uma recorrência, com sequência e ações disponíveis.",
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const { id } = recurrenceParamsSchema.parse(req.params);
      const query = recurrenceTimelineQuerySchema.parse(req.query);
      return service.timeline(req.user.sub, id, query);
    },
  );

  app.get(
    "/recurrences/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: recurrenceTag,
        summary: "Obter recorrência",
        description: "Retorna uma recorrência específica do usuário.",
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const { id } = recurrenceParamsSchema.parse(req.params);
      return service.getOne(req.user.sub, id);
    },
  );

  app.put(
    "/recurrences/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: recurrenceTag,
        summary: "Atualizar recorrência",
        description: "Atualiza uma recorrência ativa.",
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const { id } = recurrenceParamsSchema.parse(req.params);
      const body = updateRecurrenceSchema.parse(req.body);
      return service.update(req.user.sub, id, body);
    },
  );

  app.put(
    "/recurrences/:id/edit-scope",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: recurrenceTag,
        summary: "Editar recorrência por escopo",
        description:
          "Aplica edição com escopo: all (todas), this_and_next (esta e próximas), single (esta ocorrência).",
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const { id } = recurrenceParamsSchema.parse(req.params);
      const body = editRecurrenceByScopeSchema.parse(req.body);
      return service.editByScope(req.user.sub, id, body);
    },
  );

  app.put(
    "/recurrences/:id/finalize",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: recurrenceTag,
        summary: "Finalizar recorrência",
        description: "Finaliza a recorrência ativa.",
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const { id } = recurrenceParamsSchema.parse(req.params);
      return service.finalize(req.user.sub, id);
    },
  );

  app.delete(
    "/recurrences/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: recurrenceTag,
        summary: "Excluir recorrência",
        description: "Exclusão lógica permitida apenas para recorrência finalizada.",
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const { id } = recurrenceParamsSchema.parse(req.params);
      return service.remove(req.user.sub, id);
    },
  );

  app.post(
    "/recurrences/occurrences/:id/confirm",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: recurrenceTag,
        summary: "Confirmar pendência de recorrência",
        description:
          "Confirma uma ocorrência pendente de revisão e cria a transação ou transferência correspondente.",
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const { id } = recurrenceOccurrenceParamsSchema.parse(req.params);
      const body = confirmRecurrenceOccurrenceSchema.parse(req.body);
      return service.confirmOccurrence(req.user.sub, id, body);
    },
  );

  app.post(
    "/recurrences/occurrences/:id/skip",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: recurrenceTag,
        summary: "Ignorar pendência de recorrência",
        description:
          "Marca uma ocorrência pendente de revisão como ignorada, consumindo a posição da recorrência.",
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const { id } = recurrenceOccurrenceParamsSchema.parse(req.params);
      const body = skipRecurrenceOccurrenceSchema.parse(req.body);
      return service.skipOccurrence(req.user.sub, id, body);
    },
  );

  app.post(
    "/recurrences/materialize",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: recurrenceTag,
        summary: "Materializar recorrências",
        description: "Gera ocorrências pendentes até a data informada (ou data atual do timezone).",
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const body = materializeRecurrencesSchema.parse(req.body ?? {});
      return service.materialize(req.user.sub, body);
    },
  );
}
