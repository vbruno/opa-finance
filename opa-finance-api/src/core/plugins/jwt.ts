// src/core/plugins/jwt.ts
import jwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { env } from "../config/env";
import { UnauthorizedProblem } from "../errors/problems";

export default fp(async function jwtPlugin(app: FastifyInstance) {
  app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: "refreshToken",
      signed: false,
    },
    sign: {
      expiresIn: "15m",
    },
  });

  app.decorate("authenticate", async function (req: FastifyRequest, _reply: FastifyReply) {
    try {
      await req.jwtVerify();
    } catch {
      throw new UnauthorizedProblem("Token ausente ou inválido.", req.url);
    }
  });
});
