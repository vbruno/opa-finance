// test/helpers/seed/seedSubcategory.ts
import type { FastifyInstance } from "fastify";

type SeedSubcategoryOverrides = {
  categoryId: string; // obrigatório
  name?: string;
  color?: string | null;
};

export async function seedSubcategory(
  app: FastifyInstance,
  token: string,
  overrides: SeedSubcategoryOverrides,
) {
  const payload = {
    name: overrides.name ?? "Subcategoria Padrão",
    color: overrides.color ?? null,
    ...overrides,
  };

  const res = await app.inject({
    method: "POST",
    url: "/subcategories",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    payload,
  });

  return res.json();
}
