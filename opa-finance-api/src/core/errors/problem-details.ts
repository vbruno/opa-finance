export class ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;

  constructor(params: {
    type?: string;
    title?: string;
    status?: number;
    detail?: string;
    instance?: string;
  }) {
    this.type = params.type;
    this.title = params.title;
    this.status = params.status;
    this.detail = params.detail;
    this.instance = params.instance;
  }
}
