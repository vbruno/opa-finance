// test/helpers/seed/seedCategory.ts
import type { FastifyInstance } from "fastify";
import type { CategoryType } from "@/modules/categories/category.enum";

type SeedCategoryOverrides = {
  name?: string;
  type?: CategoryType;
};

export async function seedCategory(
  app: FastifyInstance,
  token: string,
  overrides: SeedCategoryOverrides = {},
) {
  const payload = {
    name: overrides.name ?? "Categoria Padrão",
    type: overrides.type ?? "expense",
    ...overrides,
  };

  const res = await app.inject({
    method: "POST",
    url: "/categories",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    payload,
  });

  return res.json();
}
