import { FastifyInstance } from "fastify";

export async function authMiddleware(app: FastifyInstance) {
  app.decorate("authenticate", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.status(401).send({ message: "Unauthorized" });
    }
  });
}
