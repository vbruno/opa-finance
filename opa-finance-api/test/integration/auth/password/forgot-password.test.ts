// test/auth/password/forgot-password.test.ts
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  extractResetTokenFromHtml,
  installEmailOutbox,
  type EmailOutbox,
} from "../../helpers/email-outbox";
import { buildTestApp } from "../../setup";

let app: FastifyInstance;
let outbox: EmailOutbox;

beforeEach(async () => {
  outbox = installEmailOutbox();
  const built = await buildTestApp();
  app = built.app;
});

afterEach(async () => {
  outbox.restore();
  await app.close();
});

describe("POST /auth/forgot-password", () => {
  async function register(email = "user@example.com") {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { "Content-Type": "application/json" },
      payload: {
        name: "User",
        email,
        password: "Aa123456!",
        confirmPassword: "Aa123456!",
      },
    });
  }

  it("envia email de reset quando o usuário existe e responde mensagem genérica", async () => {
    await register();

    const response = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      headers: { "Content-Type": "application/json" },
      payload: { email: "user@example.com" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.message).toBe("Se o email existir, enviaremos um link de redefinição.");
    expect(body).not.toHaveProperty("resetToken");

    expect(outbox.emails).toHaveLength(1);
    const [email] = outbox.emails;
    expect(email.to).toBe("user@example.com");
    expect(email.subject).toContain("Redefinir sua senha");
    const token = extractResetTokenFromHtml(email.html);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(email.text).toContain(token);
  });

  it("não envia email quando o usuário não existe (resposta continua genérica)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      headers: { "Content-Type": "application/json" },
      payload: { email: "inexistente@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe("Se o email existir, enviaremos um link de redefinição.");
    expect(outbox.emails).toHaveLength(0);
  });

  it("aplica rate limit de 5 requisições por hora por IP+email", async () => {
    await register();

    const payload = { email: "user@example.com" };

    for (let i = 0; i < 5; i += 1) {
      const ok = await app.inject({
        method: "POST",
        url: "/auth/forgot-password",
        headers: { "Content-Type": "application/json" },
        payload,
      });
      expect(ok.statusCode).toBe(200);
    }

    const blocked = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      headers: { "Content-Type": "application/json" },
      payload,
    });

    expect(blocked.statusCode).toBe(429);
    const body = blocked.json();
    expect(body.title).toBe("Too Many Requests");
    expect(body.status).toBe(429);
    expect(body.detail).toMatch(/Muitas tentativas/);
  });
});
