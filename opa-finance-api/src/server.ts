import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { config } from "dotenv";
import Fastify from "fastify";
import { env } from "./core/config/env";

config();

const app = Fastify();

app.register(cors, { origin: true });
app.register(jwt, { secret: env.JWT_SECRET! });

// Rota teste
app.get("/", () => {
  return { message: "API funcionando!" };
});

app.listen({ port: Number(env.PORT) }).then(() => {
  console.log("🔥 Server rodando na porta", env.PORT);
});
