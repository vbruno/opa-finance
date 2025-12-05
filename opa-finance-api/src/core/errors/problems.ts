import { HttpProblem } from "./http-problem";

export class NotFoundProblem extends HttpProblem {
  constructor(detail?: string, instance?: string) {
    super({
      type: "https://opa.dev/errors/not-found",
      title: "Recurso não encontrado",
      status: 404,
      detail,
      instance,
    });
  }
}

export class ForbiddenProblem extends HttpProblem {
  constructor(detail?: string, instance?: string) {
    super({
      type: "https://opa.dev/errors/forbidden",
      title: "Acesso negado",
      status: 403,
      detail,
      instance,
    });
  }
}

export class ValidationProblem extends HttpProblem {
  constructor(detail?: string, instance?: string) {
    super({
      type: "https://opa.dev/errors/validation-error",
      title: "Erro de validação",
      status: 400,
      detail,
      instance,
    });
  }
}

export class ConflictProblem extends HttpProblem {
  constructor(detail?: string, instance?: string) {
    super({
      type: "https://opa.dev/errors/conflict",
      title: "Conflito de recurso",
      status: 409,
      detail,
      instance,
    });
  }
}

// INTERNAL SERVER ERROR (500)
export class InternalProblem extends HttpProblem {
  constructor(detail: string, instance?: string) {
    super({
      type: "https://httpstatuses.com/500",
      title: "Erro interno do servidor",
      status: 500,
      detail,
      instance,
    });
  }
}
