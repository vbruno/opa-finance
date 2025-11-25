import { describe, it, expect } from "vitest";
import { app } from "../../setup";

describe("Rota /auth/check-password-strength", () => {
  it("deve retornar força 'weak' para senha fraca", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/check-password-strength",
      headers: { "Content-Type": "application/json" },
      payload: {
        password: "12345",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body).toHaveProperty("strength");
    expect(body.strength).toBe("muito fraca");
  });

  it("deve retornar força 'medium' para senha moderada", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/check-password-strength",
      headers: { "Content-Type": "application/json" },
      payload: {
        password: "Abc12345",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(
      body.strength === "média" || body.strength === "forte" || body.strength === "muito forte",
    ).toBe(true);
  });

  it("deve retornar força 'strong' para senha forte", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/check-password-strength",
      headers: { "Content-Type": "application/json" },
      payload: {
        password: "Aa123456!",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body).toHaveProperty("strength");
    expect(body.strength).toBe("muito forte");
  });

  it("deve falhar se o payload não contiver password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/check-password-strength",
      headers: { "Content-Type": "application/json" },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body).toHaveProperty("message");
  });
});
