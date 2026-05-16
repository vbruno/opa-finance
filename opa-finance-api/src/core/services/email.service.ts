import type { FastifyBaseLogger } from "fastify";
import { Resend } from "resend";
import type { CreateEmailOptions, CreateEmailResponse } from "resend";

import { env } from "../config/env";

export interface EmailClient {
  emails: {
    send(payload: CreateEmailOptions): Promise<CreateEmailResponse>;
  };
}

let cachedClient: EmailClient | null = null;
let testClientOverride: EmailClient | null = null;

function getClient(): EmailClient | null {
  if (env.NODE_ENV === "test" && testClientOverride) {
    return testClientOverride;
  }
  if (!env.RESEND_API_KEY) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = new Resend(env.RESEND_API_KEY) as unknown as EmailClient;
  }
  return cachedClient;
}

export function __setResendClientForTests(client: EmailClient | null): void {
  if (env.NODE_ENV !== "test") {
    throw new Error("__setResendClientForTests só pode ser usado em NODE_ENV=test");
  }
  testClientOverride = client;
}

export type SendResult = { id: string } | { error: string };

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  logger: FastifyBaseLogger;
}

export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  const client = getClient();
  if (!client) {
    params.logger.warn(
      { to: params.to, subject: params.subject },
      "email service indisponível (RESEND_API_KEY ausente)",
    );
    return { error: "email_provider_unavailable" };
  }

  try {
    const response = await client.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (response.error) {
      params.logger.error(
        { err: response.error, to: params.to, subject: params.subject },
        "Resend retornou erro ao enviar email",
      );
      return { error: response.error.message };
    }

    const id = response.data?.id ?? "";
    params.logger.info({ to: params.to, subject: params.subject, id }, "email enviado");
    return { id };
  } catch (err) {
    params.logger.error(
      { err, to: params.to, subject: params.subject },
      "exceção ao enviar email pelo Resend",
    );
    return { error: err instanceof Error ? err.message : "unknown_error" };
  }
}

interface SendPasswordResetEmailParams {
  to: string;
  userName: string;
  resetLink: string;
  expiresInMinutes: number;
  logger: FastifyBaseLogger;
}

export async function sendPasswordResetEmail(
  params: SendPasswordResetEmailParams,
): Promise<SendResult> {
  const safeName = escapeHtml(params.userName);
  const safeLink = escapeHtml(params.resetLink);
  const subject = "Redefinir sua senha — OPA Finance";

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
      <h1 style="font-size:20px;margin:0 0 16px;">Olá, ${safeName}</h1>
      <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">
        Recebemos uma solicitação para redefinir a senha da sua conta no OPA Finance.
      </p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 24px;">
        Clique no botão abaixo para criar uma nova senha. O link expira em ${params.expiresInMinutes} minutos e só pode ser usado uma vez.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${safeLink}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:15px;">
          Redefinir senha
        </a>
      </p>
      <p style="font-size:13px;color:#555;line-height:1.5;margin:0 0 8px;">
        Se o botão não funcionar, copie e cole o link abaixo no navegador:
      </p>
      <p style="font-size:13px;color:#0f172a;word-break:break-all;margin:0 0 24px;">
        ${safeLink}
      </p>
      <p style="font-size:13px;color:#777;line-height:1.5;margin:0;">
        Se você não solicitou essa redefinição, pode ignorar este email — sua senha continua a mesma.
      </p>
    </div>
  </body>
</html>`;

  const text = [
    `Olá, ${params.userName}`,
    "",
    "Recebemos uma solicitação para redefinir a senha da sua conta no OPA Finance.",
    `O link abaixo expira em ${params.expiresInMinutes} minutos e só pode ser usado uma vez:`,
    "",
    params.resetLink,
    "",
    "Se você não solicitou essa redefinição, pode ignorar este email — sua senha continua a mesma.",
  ].join("\n");

  return sendEmail({
    to: params.to,
    subject,
    html,
    text,
    logger: params.logger,
  });
}

interface SendPasswordChangedEmailParams {
  to: string;
  userName: string;
  changedAtFormatted: string;
  ip: string | null;
  logger: FastifyBaseLogger;
}

export async function sendPasswordChangedEmail(
  params: SendPasswordChangedEmailParams,
): Promise<SendResult> {
  const safeName = escapeHtml(params.userName);
  const safeWhen = escapeHtml(params.changedAtFormatted);
  const safeIp = params.ip ? escapeHtml(params.ip) : null;
  const subject = "Sua senha foi alterada — OPA Finance";

  const ipBlockHtml = safeIp
    ? `<p style="font-size:13px;color:#555;line-height:1.5;margin:0 0 16px;">Origem aproximada: ${safeIp}</p>`
    : "";

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
      <h1 style="font-size:20px;margin:0 0 16px;">Olá, ${safeName}</h1>
      <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">
        A senha da sua conta no OPA Finance foi alterada em <strong>${safeWhen}</strong>.
      </p>
      ${ipBlockHtml}
      <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">
        Se foi você, nenhuma ação é necessária.
      </p>
      <p style="font-size:15px;line-height:1.5;margin:0;">
        Se <strong>não foi você</strong>, recupere sua conta imediatamente solicitando uma nova redefinição de senha e entre em contato com o suporte.
      </p>
    </div>
  </body>
</html>`;

  const ipLine = params.ip ? `Origem aproximada: ${params.ip}\n` : "";
  const text = [
    `Olá, ${params.userName}`,
    "",
    `A senha da sua conta no OPA Finance foi alterada em ${params.changedAtFormatted}.`,
    ipLine.trim(),
    "Se foi você, nenhuma ação é necessária.",
    "Se NÃO foi você, recupere sua conta imediatamente solicitando uma nova redefinição de senha e entre em contato com o suporte.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return sendEmail({
    to: params.to,
    subject,
    html,
    text,
    logger: params.logger,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
