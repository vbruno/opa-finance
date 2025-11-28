import jwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { env } from "../config/env";

export default fp(async function jwtPlugin(app: FastifyInstance) {
  // 🔥 Registrar SOMENTE o JWT (NÃO registrar cookie aqui)
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

  // 🔥 Decorator authenticate
  app.decorate("authenticate", async function (req: FastifyRequest, reply: FastifyReply) {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ message: "Unauthorized" });
    }
  });
});
