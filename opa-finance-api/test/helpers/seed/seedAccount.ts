// test/helpers/seed/seedAccount.ts
import type { FastifyInstance } from "fastify";
import type { AccountType } from "../../../src/modules/accounts/account.enum";

type SeedAccountOverrides = {
  name?: string;
  type?: AccountType;
  initialBalance?: number;
  color?: string | null;
  icon?: string | null;
};

export async function seedAccount(
  app: FastifyInstance,
  token: string,
  overrides: SeedAccountOverrides = {},
) {
  const payload = {
    name: overrides.name ?? "Conta Padrão",
    type: overrides.type ?? "cash",
    initialBalance: overrides.initialBalance ?? 0,
    color: overrides.color ?? null,
    icon: overrides.icon ?? null,
  };

  const res = await app.inject({
    method: "POST",
    url: "/accounts",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    payload,
  });

  return res.json();
}
