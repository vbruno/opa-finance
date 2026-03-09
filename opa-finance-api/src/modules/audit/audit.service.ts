import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
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
type AuditListQuery = {
  page: number;
  limit: number;
  entityType?: AuditEntityType;
  action?: AuditAction;
  startDate?: string;
  endDate?: string;
};

const REDACTED_VALUE = "[REDACTED]";

const SENSITIVE_FIELD_NAMES = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "confirmpassword",
  "confirm_password",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "authorization",
  "jwt",
  "secret",
  "cookie",
  "set-cookie",
  "set_cookie",
  "apikey",
  "api_key",
  "clientsecret",
  "client_secret",
]);

export class AuditService {
  constructor(private app: FastifyInstance) {}

  private sanitizeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item));
    }

    if (typeof value === "object") {
      const input = value as Record<string, unknown>;
      const output: Record<string, unknown> = {};

      for (const [key, innerValue] of Object.entries(input)) {
        const normalizedKey = key.toLowerCase().replace(/\s+/g, "");
        if (SENSITIVE_FIELD_NAMES.has(normalizedKey)) {
          output[key] = REDACTED_VALUE;
          continue;
        }
        output[key] = this.sanitizeValue(innerValue);
      }

      return output;
    }

    return value;
  }

  async log(payload: AuditPayload, db?: DBLike) {
    const target = db ?? this.app.db;

    await target.insert(auditLogs).values({
      userId: payload.userId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      action: payload.action,
      beforeData:
        (this.sanitizeValue(payload.beforeData) as Record<string, unknown> | null) ?? null,
      afterData: (this.sanitizeValue(payload.afterData) as Record<string, unknown> | null) ?? null,
      metadata: (this.sanitizeValue(payload.metadata) as Record<string, unknown> | null) ?? null,
    });
  }

  async list(userId: string, query: AuditListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const filters = [eq(auditLogs.userId, userId)];

    if (query.entityType) {
      filters.push(eq(auditLogs.entityType, query.entityType));
    }

    if (query.action) {
      filters.push(eq(auditLogs.action, query.action));
    }

    if (query.startDate) {
      filters.push(gte(auditLogs.createdAt, new Date(`${query.startDate}T00:00:00.000Z`)));
    }

    if (query.endDate) {
      filters.push(lte(auditLogs.createdAt, new Date(`${query.endDate}T23:59:59.999Z`)));
    }

    const [totalRow] = await this.app.db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(and(...filters));

    const rows = await this.app.db
      .select()
      .from(auditLogs)
      .where(and(...filters))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      page,
      limit,
      total: Number(totalRow?.count ?? 0),
    };
  }
}
