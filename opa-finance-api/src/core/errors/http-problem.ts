// src/core/errors/http-problem.ts

/**
 * RFC 7807 - Problem Details as an Error object
 */
export class HttpProblem extends Error {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;

  constructor(params: {
    type?: string;
    title: string;
    status: number;
    detail?: string;
    instance?: string;
  }) {
    super(params.detail ?? params.title);

    // Ajuste obrigatório para herança correta em TS/JS
    Object.setPrototypeOf(this, new.target.prototype);

    // Nome da classe (útil para debugging)
    this.name = new.target.name;

    this.type = params.type ?? "about:blank";
    this.title = params.title;
    this.status = params.status;
    this.detail = params.detail;
    this.instance = params.instance;

    // Mantém erro limpo em Node / Fastify
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }

  /**
   * Serialização no padrão RFC7807
   */
  toJSON() {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      ...(this.detail ? { detail: this.detail } : {}),
      ...(this.instance ? { instance: this.instance } : {}),
    };
  }
}
