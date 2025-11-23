export function getPasswordScore(password: string): number {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  return score; // vai de 0 a 5
}

export function getPasswordStrength(password: string): string {
  const score = getPasswordScore(password);

  if (score <= 1) return "muito fraca";
  if (score === 2) return "fraca";
  if (score === 3) return "média";
  if (score === 4) return "forte";
  if (score === 5) return "muito forte";

  return "desconhecida";
}
