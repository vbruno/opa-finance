import { FastifyInstance } from "fastify";

export async function systemRoutes(app: FastifyInstance) {
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Health check",
        description: "Verifica disponibilidade da API.",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
            },
            example: {
              status: "ok",
            },
          },
        },
      },
    },
    () => {
      return { status: "ok" };
    },
  );

  app.get(
    "/",
    {
      schema: {
        tags: ["Health"],
        summary: "Raiz da API",
        description: "Retorna mensagem basica de status.",
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
            example: {
              message: "API funcionando!",
            },
          },
        },
      },
    },
    () => {
      return { message: "API funcionando!" };
    },
  );
}
