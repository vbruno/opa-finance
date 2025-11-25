import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword } from "../../../src/core/utils/hash.utils";
import { users } from "../../../src/db/schema";
import { app, db } from "../../setup";

describe("Rota /auth/forgot-password", () => {
  beforeEach(async () => {
    await db.delete(users);
  });

  it("deve retornar resetToken quando o email existir", async () => {
    await db.insert(users).values({
      name: "Bruno",
      email: "bruno@example.com",
      passwordHash: await hashPassword("Aa123456!"),
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      headers: {
        "Content-Type": "application/json",
      },
      payload: {
        email: "bruno@example.com",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body).toHaveProperty("message");
    expect(body.message).toBe("Se o email existir, enviaremos um link de redefinição.");

    // token é retornado apenas para debug (e você marcou isso no código)
    expect(body).toHaveProperty("resetToken");
    expect(typeof body.resetToken).toBe("string");
  });

  it("deve retornar sucesso mesmo se o email não existir", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      headers: {
        "Content-Type": "application/json",
      },
      payload: {
        email: "naoexiste@example.com",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.message).toBe("Se o email existir, enviaremos um link de redefinição.");
  });

  it("deve falhar se o email for inválido (Zod)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      headers: {
        "Content-Type": "application/json",
      },
      payload: {
        email: "invalido",
      },
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();
    expect(body).toHaveProperty("message");
  });
});
