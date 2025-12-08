// src/core/errors/problem-details.ts

/**
 * Interface RFC 7807 para padronizar o shape de erros.
 * Não deve ser uma classe, pois quem deve ser Error é HttpProblem.
 */
export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}
