import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword } from "../../../src/core/utils/hash.utils";
import { users } from "../../../src/db/schema";
import { app, db } from "../../setup";

describe("Rota /auth/reset-password", () => {
  beforeEach(async () => {
    await db.delete(users);
  });

  async function createUserAndToken() {
    const [user] = await db
      .insert(users)
      .values({
        name: "Bruno",
        email: "bruno@example.com",
        passwordHash: await hashPassword("Aa123456!"),
      })
      .returning();

    // gerar token usando a rota forgot-password
    const forgotResponse = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      headers: { "Content-Type": "application/json" },
      payload: { email: "bruno@example.com" },
    });

    const { resetToken } = forgotResponse.json();

    return { user, resetToken };
  }

  it("deve resetar a senha com um token válido", async () => {
    const { user, resetToken } = await createUserAndToken();

    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token: resetToken,
        newPassword: "Bb987654!",
        confirmNewPassword: "Bb987654!",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe("Senha redefinida com sucesso.");

    // login com senha antiga → deve falhar
    const oldLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: user.email,
        password: "Aa123456!",
      },
    });

    expect(oldLogin.statusCode).toBe(400);

    // login com nova senha → deve funcionar
    const newLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: user.email,
        password: "Bb987654!",
      },
    });

    expect(newLogin.statusCode).toBe(200);
    expect(newLogin.json()).toHaveProperty("accessToken");
  });

  it("deve falhar com token inválido", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token: "token_invalido",
        newPassword: "Bb987654!",
        confirmNewPassword: "Bb987654!",
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("deve falhar se as senhas não coincidirem", async () => {
    const { resetToken } = await createUserAndToken();

    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token: resetToken,
        newPassword: "Bb987654!",
        confirmNewPassword: "OutraSenha!",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe("As senhas não conferem.");
  });

  it("deve falhar se a senha for fraca", async () => {
    const { resetToken } = await createUserAndToken();

    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token: resetToken,
        newPassword: "123",
        confirmNewPassword: "123",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty("message");
  });
});
