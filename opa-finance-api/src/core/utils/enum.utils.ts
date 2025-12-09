// src/core/utils/enum.utils.ts

/**
 * Converte um array comum (`string[]`)
 * em uma tuple literal (`readonly string[]`)
 * compatível com z.enum() do Zod v4.
 */
// Converte string[] → readonly string[]
export function toEnumValues(values: string[]) {
  return values as unknown as readonly string[];
}
