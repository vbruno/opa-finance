import type { CreateEmailOptions, CreateEmailResponse } from "resend";

import { __setResendClientForTests, type EmailClient } from "@/core/services/email.service";

export interface CapturedEmail {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailOutbox {
  emails: CapturedEmail[];
  clear: () => void;
  restore: () => void;
}

export function installEmailOutbox(): EmailOutbox {
  const captured: CapturedEmail[] = [];

  const stub: EmailClient = {
    emails: {
      send: async (payload: CreateEmailOptions): Promise<CreateEmailResponse> => {
        captured.push({
          from: String(payload.from ?? ""),
          to: normalizeRecipient(payload.to),
          subject: String(payload.subject ?? ""),
          html: typeof payload.html === "string" ? payload.html : "",
          text: typeof payload.text === "string" ? payload.text : "",
        });

        return {
          data: { id: `test-${captured.length}` },
          error: null,
          headers: null,
        } as CreateEmailResponse;
      },
    },
  };

  __setResendClientForTests(stub);

  return {
    emails: captured,
    clear: () => {
      captured.splice(0, captured.length);
    },
    restore: () => {
      __setResendClientForTests(null);
    },
  };
}

function normalizeRecipient(to: CreateEmailOptions["to"]): string {
  if (typeof to === "string") {
    return to;
  }
  if (Array.isArray(to) && to.length > 0 && typeof to[0] === "string") {
    return to[0];
  }
  return "";
}

export function extractResetTokenFromHtml(html: string): string {
  const match = html.match(/reset-password\?token=([a-f0-9]{64})/);
  if (!match) {
    throw new Error("Token de reset não encontrado no HTML do email.");
  }
  return match[1];
}
