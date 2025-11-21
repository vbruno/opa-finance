import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { config } from "dotenv";

config();

const app = Fastify();

app.register(cors, { origin: true });
app.register(jwt, { secret: process.env.JWT_SECRET! });

// Rota teste
app.get("/", () => {
  return { message: "API funcionando!" };
});

app.listen({ port: Number(process.env.PORT) }).then(() => {
  console.log("🔥 Server rodando na porta", process.env.PORT);
});
