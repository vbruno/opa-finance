import "fastify";
import "@fastify/jwt";

declare module "fastify" {
  interface FastifyRequest {
    user: {
      sub: string;
    };
  }

  interface FastifyInstance {
    authenticate: any; // middleware global
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string }; // payload que você envia no sign()
    user: { sub: string }; // payload já validado
  }
}
