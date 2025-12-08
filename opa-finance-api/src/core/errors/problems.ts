// src/core/errors/problems.ts
import { HttpProblem } from "./http-problem";

/* Helper para construir URLs próprias da API */
const BASE = "https://opa.dev/errors";

/* -------------------------------------------------------------------------- */
/*                              400 - Bad Request                              */
/* -------------------------------------------------------------------------- */
export class BadRequestProblem extends HttpProblem {
  constructor(detail = "Requisição inválida", instance?: string) {
    super({
      type: `${BASE}/bad-request`,
      title: "Bad Request",
      status: 400,
      detail,
      instance,
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                            401 - Unauthorized                               */
/* -------------------------------------------------------------------------- */
export class UnauthorizedProblem extends HttpProblem {
  constructor(detail = "Não autorizado", instance?: string) {
    super({
      type: `${BASE}/unauthorized`,
      title: "Unauthorized",
      status: 401,
      detail,
      instance,
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                               403 - Forbidden                               */
/* -------------------------------------------------------------------------- */
export class ForbiddenProblem extends HttpProblem {
  constructor(detail = "Acesso negado", instance?: string) {
    super({
      type: `${BASE}/forbidden`,
      title: "Forbidden",
      status: 403,
      detail,
      instance,
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                               404 - Not Found                               */
/* -------------------------------------------------------------------------- */
export class NotFoundProblem extends HttpProblem {
  constructor(detail = "Recurso não encontrado", instance?: string) {
    super({
      type: `${BASE}/not-found`,
      title: "Not Found",
      status: 404,
      detail,
      instance,
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                                409 - Conflict                               */
/* -------------------------------------------------------------------------- */
export class ConflictProblem extends HttpProblem {
  constructor(detail = "Conflito ao processar requisição", instance?: string) {
    super({
      type: `${BASE}/conflict`,
      title: "Conflict",
      status: 409,
      detail,
      instance,
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                         400 - Validation Error                              */
/* -------------------------------------------------------------------------- */
export class ValidationProblem extends HttpProblem {
  constructor(detail = "Erro de validação", instance?: string) {
    super({
      type: `${BASE}/validation-error`,
      title: "Validation Error",
      status: 400,
      detail,
      instance,
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                        500 - Internal Server Error                          */
/* -------------------------------------------------------------------------- */
export class InternalProblem extends HttpProblem {
  constructor(detail = "Erro interno do servidor", instance?: string) {
    super({
      type: `${BASE}/internal-error`,
      title: "Internal Server Error",
      status: 500,
      detail,
      instance,
    });
  }
}
