// test/helpers/auth.ts
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { DB } from "../../src/core/plugins/drizzle";
import { users } from "../../src/db/schema";

export async function registerAndLogin(
  app: FastifyInstance,
  db: DB,
  email = "user@test.com",
  name = "User Test",
) {
  const passwordPayload = {
    name,
    email,
    password: "Aa123456!",
    confirmPassword: "Aa123456!",
  };

  // ------------------------- REGISTER -------------------------
  const registerResponse = await app.inject({
    method: "POST",
    url: "/auth/register",
    headers: { "Content-Type": "application/json" },
    payload: passwordPayload,
  });

  if (registerResponse.statusCode !== 201) {
    throw new Error(
      `[registerAndLogin] Falha no registro (${email}) → Status ${registerResponse.statusCode}\nBody: ${registerResponse.body}`,
    );
  }

  // --------------------------- LOGIN ---------------------------
  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: { "Content-Type": "application/json" },
    payload: { email, password: "Aa123456!" },
  });

  if (loginResponse.statusCode !== 200) {
    throw new Error(
      `[registerAndLogin] Falha no login (${email}) → Status ${loginResponse.statusCode}\nBody: ${loginResponse.body}`,
    );
  }

  const { accessToken } = loginResponse.json();

  if (!accessToken || typeof accessToken !== "string") {
    throw new Error(
      `[registerAndLogin] Token inválido retornado pelo login. Valor: ${String(accessToken)}`,
    );
  }

  // ------------------------- GET USER --------------------------
  const [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user) {
    throw new Error(
      `[registerAndLogin] Usuário criado (${email}) não encontrado no DB após registro.`,
    );
  }

  return { token: accessToken, user };
}
