import { describe, it, expect } from "vitest";
import { app } from "../setup";

describe("Registro de usuário", () => {
  it("deve registrar um usuário com sucesso", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: {
        "Content-Type": "application/json",
      },
      payload: {
        name: "Bruno",
        email: "bruno@example.com",
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });

    console.log(response.body);

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body).toHaveProperty("accessToken");
  });
});
