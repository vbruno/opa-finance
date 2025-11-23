import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { config } from "dotenv";
import Fastify from "fastify";
import { env } from "./core/config/env";
import jwtPlugin from "./core/plugins/jwt";
import { authRoutes } from "./modules/auth/auth.routes";

config();

const app = Fastify();

app.register(cors, { origin: true });

app.register(cookie);

app.register(jwtPlugin);
app.register(authRoutes);

// Rota teste
app.get("/", () => {
  return { message: "API funcionando!" };
});

app.listen({ port: Number(env.PORT) }).then(() => {
  console.log("🔥 Server rodando na porta", env.PORT);
});
