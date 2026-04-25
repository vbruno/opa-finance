import type { FastifyInstance } from "fastify";
import { AuditService } from "../audit/audit.service";
import { RecurrenceCrudService } from "./recurrence-crud.service";
import { RecurrenceEditService } from "./recurrence-edit.service";
import { RecurrenceForecastService } from "./recurrence-forecast.service";
import { RecurrenceMaterializeService } from "./recurrence-materialize.service";
import { RecurrenceAudit } from "./recurrence.audit";
import type {
  CreateRecurrenceInput,
  EditRecurrenceByScopeInput,
  ListRecurrencesQuery,
  MaterializeRecurrencesInput,
  RecurrencesForecastQuery,
  UpdateRecurrenceInput,
} from "./recurrence.schemas";
import { RecurrenceValidators } from "./recurrence.validators";

export class RecurrenceService {
  private audit: AuditService;
  private recurrenceAudit: RecurrenceAudit;
  private validators: RecurrenceValidators;
  private crud: RecurrenceCrudService;
  private edit: RecurrenceEditService;
  private materializeService: RecurrenceMaterializeService;
  private forecastService: RecurrenceForecastService;

  constructor(private app: FastifyInstance) {
    this.audit = new AuditService(app);
    this.recurrenceAudit = new RecurrenceAudit(this.audit, app.log);
    this.validators = new RecurrenceValidators(app.db);
    this.crud = new RecurrenceCrudService(app, this.audit, this.recurrenceAudit, this.validators);
    this.edit = new RecurrenceEditService(
      app,
      this.audit,
      this.recurrenceAudit,
      this.validators,
      this.crud,
    );
    this.materializeService = new RecurrenceMaterializeService(
      app,
      this.recurrenceAudit,
      this.validators,
    );
    this.forecastService = new RecurrenceForecastService(app, this.validators);
  }

  async create(userId: string, data: CreateRecurrenceInput) {
    return this.crud.create(userId, data);
  }

  async list(userId: string, query: ListRecurrencesQuery) {
    return this.crud.list(userId, query);
  }

  async getOne(userId: string, recurrenceId: string) {
    return this.crud.getOne(userId, recurrenceId);
  }

  async update(userId: string, recurrenceId: string, data: UpdateRecurrenceInput) {
    return this.edit.update(userId, recurrenceId, data);
  }

  async editByScope(userId: string, recurrenceId: string, input: EditRecurrenceByScopeInput) {
    return this.edit.editByScope(userId, recurrenceId, input);
  }

  async finalize(userId: string, recurrenceId: string) {
    return this.crud.finalize(userId, recurrenceId);
  }

  async remove(userId: string, recurrenceId: string) {
    return this.crud.remove(userId, recurrenceId);
  }

  async materialize(userId: string, input: MaterializeRecurrencesInput) {
    return this.materializeService.materialize(userId, input);
  }

  async forecast(userId: string, query: RecurrencesForecastQuery) {
    return this.forecastService.forecast(userId, query);
  }
}
