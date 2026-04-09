import { describe, expect, it, vi } from "vitest";
import { ValidationProblem } from "@/core/errors/problems";
import { ensureValidTimezone } from "@/core/utils/timezone-db.utils";

describe("timezone db utils", () => {
  it("aceita timezone existente no catálogo do banco", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue({ rows: [{ ok: 1 }] }),
    } as unknown as Parameters<typeof ensureValidTimezone>[0];

    await expect(
      ensureValidTimezone(db, "America/Sao_Paulo", "/users/123"),
    ).resolves.toBeUndefined();
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it("rejeita timezone vazio", async () => {
    const db = {
      execute: vi.fn(),
    } as unknown as Parameters<typeof ensureValidTimezone>[0];

    await expect(ensureValidTimezone(db, "   ", "/users/123")).rejects.toBeInstanceOf(
      ValidationProblem,
    );
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("rejeita timezone inexistente", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Parameters<typeof ensureValidTimezone>[0];

    await expect(ensureValidTimezone(db, "Invalid/Timezone", "/users/123")).rejects.toBeInstanceOf(
      ValidationProblem,
    );
    expect(db.execute).toHaveBeenCalledTimes(1);
  });
});
