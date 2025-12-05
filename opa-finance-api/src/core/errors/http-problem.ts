import { ProblemDetails } from "./problem-details";

export class HttpProblem extends ProblemDetails {
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
    super({
      type: params.type ?? "about:blank",
      title: params.title,
      status: params.status,
      detail: params.detail,
      instance: params.instance,
    });

    // Corrige prototype (necessário no TS)
    Object.setPrototypeOf(this, new.target.prototype);

    this.type = params.type ?? "about:blank"; // RFC 7807 default
    this.title = params.title;
    this.status = params.status;
    this.detail = params.detail;
    this.instance = params.instance;

    // Mantém stack trace limpa
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpProblem);
    }
  }

  toJSON() {
    const json: Record<string, unknown> = {
      type: this.type,
      title: this.title,
      status: this.status,
    };

    if (this.detail !== undefined) json.detail = this.detail;
    if (this.instance !== undefined) json.instance = this.instance;

    return json;
  }
}
