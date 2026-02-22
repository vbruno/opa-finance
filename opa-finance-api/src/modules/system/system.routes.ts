import { FastifyInstance } from "fastify";
import { APP_BUILD_TIME, APP_GIT_COMMIT, APP_VERSION } from "../../generated/app-version";

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
    "/version",
    {
      schema: {
        tags: ["Health"],
        summary: "Versão da API",
        description: "Retorna versão, commit e data de build da API.",
        response: {
          200: {
            type: "object",
            properties: {
              version: { type: "string" },
              commit: { type: "string" },
              buildTime: { type: "string" },
            },
          },
        },
      },
    },
    () => {
      return {
        version: APP_VERSION,
        commit: APP_GIT_COMMIT,
        buildTime: APP_BUILD_TIME,
      };
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
