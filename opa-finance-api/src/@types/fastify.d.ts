import "fastify";
import "@fastify/jwt";
declare module "fastify" {
  interface FastifyRequest {
    user: {
      sub: string;
    };
  }

  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
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
    payload: { sub: string; type?: string }; // payload que você envia no sign()
    user: { sub: string; type?: string }; // payload já validado
  }
}
