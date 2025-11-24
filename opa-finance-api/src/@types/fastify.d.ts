import "fastify";
import "@fastify/jwt";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";

declare module "fastify" {
  interface FastifyRequest {
    user: {
      sub: string;
      type?: string;
    };
  }

  interface FastifyInstance {
    // Método de autenticação JWT
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

    // Banco de dados (Postgres em produção, SQLite em testes)
    db: BetterSQLite3Database<typeof schema> | any;
  }

  interface FastifyReply {
    setCookie(
      name: string,
      value: string,
      options?: {
        path?: string;
        domain?: string;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: "lax" | "strict" | "none";
        maxAge?: number;
        expires?: Date;
        signed?: boolean;
        overwrite?: boolean;
      },
    ): this;

    clearCookie(
      name: string,
      options?: {
        path?: string;
        domain?: string;
        expires?: Date;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: "lax" | "strict" | "none";
      },
    ): this;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    // Payload gerado no sign()
    payload: {
      sub: string;
      type?: string; // permite "reset", "access", etc
    };

    // O que aparece em req.user após verify()
    user: {
      sub: string;
      type?: string;
    };
  }
}
