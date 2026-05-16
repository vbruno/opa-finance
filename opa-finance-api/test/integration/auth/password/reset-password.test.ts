import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  extractResetTokenFromHtml,
  installEmailOutbox,
  type EmailOutbox,
} from "../../helpers/email-outbox";
import { buildTestApp } from "../../setup";
import type { DB } from "@/core/plugins/drizzle";
import { passwordResetTokens, users } from "@/db/schema";

let app: FastifyInstance;
let db: DB;
let outbox: EmailOutbox;

beforeEach(async () => {
  outbox = installEmailOutbox();
  const built = await buildTestApp();
  app = built.app;
  db = built.db;
});

afterEach(async () => {
  outbox.restore();
  await app.close();
});

describe("POST /auth/reset-password", () => {
  async function registerUserAndRequestReset(email = "user@example.com") {
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

    await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      headers: { "Content-Type": "application/json" },
      payload: { email },
    });

    const sent = outbox.emails.find(
      (e) => e.to === email && e.subject.includes("Redefinir sua senha"),
    );
    if (!sent) {
      throw new Error("Email de reset não foi capturado pelo stub.");
    }
    return extractResetTokenFromHtml(sent.html);
  }

  it("redefine a senha com sucesso e envia email de confirmação", async () => {
    outbox.clear();
    const token = await registerUserAndRequestReset();

    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token,
        newPassword: "NewPassword1!",
        confirmNewPassword: "NewPassword1!",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe("Senha redefinida com sucesso.");

    const confirmEmail = outbox.emails.find((e) => e.subject.includes("Sua senha foi alterada"));
    expect(confirmEmail).toBeDefined();
    expect(confirmEmail?.to).toBe("user@example.com");
  });

  it("falha com token inválido", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token: "token-invalido",
        newPassword: "NewPassword1!",
        confirmNewPassword: "NewPassword1!",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().title).toBe("Validation Error");
  });

  it("falha com token expirado", async () => {
    const token = await registerUserAndRequestReset();

    // Força expiração via UPDATE direto
    await db.update(passwordResetTokens).set({ expiresAt: new Date(Date.now() - 60_000) });

    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token,
        newPassword: "NewPassword1!",
        confirmNewPassword: "NewPassword1!",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().detail).toBe("Token inválido ou expirado.");
  });

  it("rejeita reutilização do mesmo token", async () => {
    const token = await registerUserAndRequestReset();

    const first = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token,
        newPassword: "NewPassword1!",
        confirmNewPassword: "NewPassword1!",
      },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token,
        newPassword: "OutraSenha2@",
        confirmNewPassword: "OutraSenha2@",
      },
    });

    expect(second.statusCode).toBe(400);
    expect(second.json().detail).toBe("Token inválido ou expirado.");
  });

  it("invalida outros tokens ativos do mesmo usuário ao resetar", async () => {
    // Gera dois tokens para o mesmo usuário
    const firstToken = await registerUserAndRequestReset();

    await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      headers: { "Content-Type": "application/json" },
      payload: { email: "user@example.com" },
    });

    const allEmails = outbox.emails.filter((e) => e.subject.includes("Redefinir sua senha"));
    expect(allEmails.length).toBeGreaterThanOrEqual(2);
    const secondToken = extractResetTokenFromHtml(allEmails[allEmails.length - 1].html);
    expect(secondToken).not.toBe(firstToken);

    // Consome o segundo
    const ok = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token: secondToken,
        newPassword: "NewPassword1!",
        confirmNewPassword: "NewPassword1!",
      },
    });
    expect(ok.statusCode).toBe(200);

    // O primeiro agora deve estar invalidado
    const blocked = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token: firstToken,
        newPassword: "OutraSenha2@",
        confirmNewPassword: "OutraSenha2@",
      },
    });
    expect(blocked.statusCode).toBe(400);

    // Confirma que ambos os tokens estão marcados como used_at
    const [user] = await db.select().from(users).where(eq(users.email, "user@example.com"));
    if (!user) throw new Error("usuário não encontrado");

    const remaining = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));
    expect(remaining.every((t) => t.usedAt !== null)).toBe(true);
  });

  it("falha com senhas diferentes", async () => {
    const token = await registerUserAndRequestReset();

    const response = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      headers: { "Content-Type": "application/json" },
      payload: {
        token,
        newPassword: "NewPassword1!",
        confirmNewPassword: "OutraSenha!",
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
