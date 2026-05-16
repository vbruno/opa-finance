import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  RESET_TOKEN_TTL_MINUTES,
  buildResetLink,
  hashResetToken,
} from "../../../src/modules/auth/password-reset.utils";

describe("password-reset.utils", () => {
  describe("hashResetToken", () => {
    it("produz sha256 hex de 64 chars determinístico", () => {
      const token = "abc123";
      const hash = hashResetToken(token);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).toBe(hashResetToken(token));
    });

    it("bate com sha256 padrão da node:crypto", () => {
      const token = "qualquer-token-cru";
      const expected = createHash("sha256").update(token).digest("hex");
      expect(hashResetToken(token)).toBe(expected);
    });

    it("produz hashes diferentes para tokens diferentes", () => {
      expect(hashResetToken("a")).not.toBe(hashResetToken("b"));
    });
  });

  describe("buildResetLink", () => {
    it("monta link com baseUrl e query token", () => {
      const link = buildResetLink("http://localhost:5173", "deadbeef");
      expect(link).toBe("http://localhost:5173/reset-password?token=deadbeef");
    });

    it("respeita o baseUrl recebido (sem reescrita de domínio)", () => {
      const link = buildResetLink("https://finance.opadev.com", "xyz");
      expect(link).toBe("https://finance.opadev.com/reset-password?token=xyz");
    });
  });

  it("exporta TTL de 15 minutos", () => {
    expect(RESET_TOKEN_TTL_MINUTES).toBe(15);
  });
});
