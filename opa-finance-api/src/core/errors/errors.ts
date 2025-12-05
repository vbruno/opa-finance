// src/core/errors.ts
export class NotFoundError extends Error {
  constructor(message = "Recurso não encontrado") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Acesso negado") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends Error {
  constructor(message = "Conflito") {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  constructor(message = "Dados inválidos") {
    super(message);
    this.name = "ValidationError";
  }
}
