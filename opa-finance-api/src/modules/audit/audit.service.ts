import { FastifyInstance } from "fastify";

import { auditLogs } from "../../db/schema";

export type AuditEntityType = "transaction" | "account" | "category" | "subcategory";
export type AuditAction = "create" | "update" | "delete";

type AuditPayload = {
  userId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

type DBLike = FastifyInstance["db"];

export class AuditService {
  constructor(private app: FastifyInstance) {}

  async log(payload: AuditPayload, db?: DBLike) {
    const target = db ?? this.app.db;

    await target.insert(auditLogs).values({
      userId: payload.userId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      action: payload.action,
      beforeData: payload.beforeData ?? null,
      afterData: payload.afterData ?? null,
      metadata: payload.metadata ?? null,
    });
  }
}
