import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword } from "../../../src/core/utils/hash.utils";
import { users } from "../../../src/db/schema";
import { app, db } from "../../setup";

describe("Rota /auth/change-password", () => {
  beforeEach(async () => {
    await db.delete(users);
  });

  async function createAndLoginUser() {
    const passwordHash = await hashPassword("Aa123456!");

    const [user] = await db
      .insert(users)
      .values({
        name: "Bruno",
        email: "bruno@example.com",
        passwordHash,
      })
      .returning();

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: "bruno@example.com",
        password: "Aa123456!",
      },
    });

    const { accessToken } = loginResponse.json();

    return { user, accessToken };
  }

  it("deve alterar a senha com sucesso", async () => {
    const { user, accessToken } = await createAndLoginUser();

    // alterar senha
    const response = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        currentPassword: "Aa123456!",
        newPassword: "Bb987654!",
        confirmNewPassword: "Bb987654!",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe("Senha alterada com sucesso.");

    // login com a senha antiga deve falhar
    const oldLoginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: user.email,
        password: "Aa123456!",
      },
    });

    expect(oldLoginResponse.statusCode).toBe(400);

    // login com a nova senha deve funcionar
    const newLoginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "Content-Type": "application/json" },
      payload: {
        email: user.email,
        password: "Bb987654!",
      },
    });

    expect(newLoginResponse.statusCode).toBe(200);
    expect(newLoginResponse.json()).toHaveProperty("accessToken");
  });

  it("deve falhar se a senha atual estiver incorreta", async () => {
    const { accessToken } = await createAndLoginUser();

    const response = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        currentPassword: "SenhaErrada!",
        newPassword: "Bb987654!",
        confirmNewPassword: "Bb987654!",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe("Senha atual incorreta.");
  });

  it("deve falhar se a nova senha for fraca", async () => {
    const { accessToken } = await createAndLoginUser();

    const response = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        currentPassword: "Aa123456!",
        newPassword: "123",
        confirmNewPassword: "123",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty("message");
  });

  it("deve falhar se as senhas não coincidirem", async () => {
    const { accessToken } = await createAndLoginUser();

    const response = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        currentPassword: "Aa123456!",
        newPassword: "Bb987654!",
        confirmNewPassword: "OutraSenha!",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty("message");
    expect(response.json().message).toContain("A confirmação da nova senha não confere.");
  });

  it("deve retornar 401 sem token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      payload: {
        currentPassword: "Aa123456!",
        newPassword: "Bb987654!",
        confirmNewPassword: "Bb987654!",
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
