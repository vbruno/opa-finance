import { and, desc, eq, gte, lte, sql, SQL } from "drizzle-orm";
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
  view?: "raw" | "grouped";
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

  private toRows<T>(result: unknown): T[] {
    return Array.isArray(result) ? result : ((result as { rows?: T[] }).rows ?? []);
  }

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

  private getObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private getStringValue(obj: Record<string, unknown> | null, key: string): string | null {
    const value = obj?.[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      return null;
    }
    return value;
  }

  private buildSummary(row: {
    entityType: AuditEntityType;
    action: AuditAction;
    entityId: string;
    beforeData: Record<string, unknown> | null;
    afterData: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  }) {
    const accountName =
      this.getStringValue(row.afterData, "accountName") ??
      this.getStringValue(row.beforeData, "accountName") ??
      this.getStringValue(row.metadata, "accountName");
    const categoryName =
      this.getStringValue(row.afterData, "categoryName") ??
      this.getStringValue(row.beforeData, "categoryName") ??
      this.getStringValue(row.metadata, "categoryName");
    const subcategoryName =
      this.getStringValue(row.afterData, "subcategoryName") ??
      this.getStringValue(row.beforeData, "subcategoryName") ??
      this.getStringValue(row.metadata, "subcategoryName");
    const accountId =
      this.getStringValue(row.afterData, "accountId") ??
      this.getStringValue(row.beforeData, "accountId") ??
      this.getStringValue(row.metadata, "accountId");
    const categoryId =
      this.getStringValue(row.afterData, "categoryId") ??
      this.getStringValue(row.beforeData, "categoryId") ??
      this.getStringValue(row.metadata, "categoryId");
    const subcategoryId =
      this.getStringValue(row.afterData, "subcategoryId") ??
      this.getStringValue(row.beforeData, "subcategoryId") ??
      this.getStringValue(row.metadata, "subcategoryId");

    const preferredDescriptionKeys = ["description", "name", "title", "notes", "email"];
    let description: string | null = null;
    for (const key of preferredDescriptionKeys) {
      description =
        this.getStringValue(row.afterData, key) ?? this.getStringValue(row.beforeData, key);
      if (description) {
        break;
      }
    }

    if (!description) {
      description = `ID ${row.entityId}`;
    }

    return {
      screen:
        row.entityType === "transaction"
          ? "Transações"
          : row.entityType === "account"
            ? "Contas"
            : row.entityType === "category"
              ? "Categorias"
              : "Subcategorias",
      action: row.action === "create" ? "Criação" : row.action === "update" ? "Edição" : "Exclusão",
      description,
      accountName: accountName ?? accountId ?? null,
      categoryName: categoryName ?? categoryId ?? null,
      subcategoryName: subcategoryName ?? subcategoryId ?? null,
    };
  }

  private toFriendlyData(data: Record<string, unknown> | null) {
    if (!data) {
      return null;
    }

    const hiddenKeys = new Set(["userId", "createdAt", "updatedAt"]);
    const labels: Record<string, string> = {
      id: "ID",
      date: "Data",
      type: "Tipo",
      notes: "Notas",
      amount: "Valor",
      accountId: "Conta",
      accountName: "Conta",
      categoryId: "Categoria",
      categoryName: "Categoria",
      subcategoryId: "Subcategoria",
      subcategoryName: "Subcategoria",
      transferId: "Transferência",
      description: "Descrição",
      operation: "Operação",
      side: "Lado",
      grouped: "Agrupado",
      groupSize: "Quantidade",
    };

    const preferredOrder = [
      "description",
      "notes",
      "amount",
      "type",
      "date",
      "accountId",
      "categoryId",
      "subcategoryId",
      "transferId",
      "operation",
      "side",
      "grouped",
      "groupSize",
      "id",
    ];

    const orderedKeys = [
      ...preferredOrder.filter((key) => key in data),
      ...Object.keys(data).filter((key) => !preferredOrder.includes(key)),
    ];

    const output: Record<string, string> = {};
    for (const key of orderedKeys) {
      if (hiddenKeys.has(key)) {
        continue;
      }

      const value = data[key];
      if (value === null || value === undefined || value === "") {
        continue;
      }

      let friendlyValue: string;

      if (key === "type" && typeof value === "string") {
        friendlyValue = value === "income" ? "Receita" : value === "expense" ? "Despesa" : value;
      } else if (key === "date" && typeof value === "string") {
        const date = new Date(`${value}T00:00:00`);
        friendlyValue = Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
      } else if (key === "amount") {
        const numeric = Number(value);
        friendlyValue = Number.isFinite(numeric)
          ? new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(numeric)
          : String(value);
      } else if (typeof value === "boolean") {
        friendlyValue = value ? "Sim" : "Não";
      } else if (typeof value === "string" || typeof value === "number") {
        friendlyValue = String(value);
      } else {
        friendlyValue = JSON.stringify(value);
      }

      output[labels[key] ?? key] = friendlyValue;
    }

    return output;
  }

  private enrichRows<
    T extends {
      entityType: AuditEntityType;
      action: AuditAction;
      entityId: string;
      beforeData: Record<string, unknown> | null;
      afterData: Record<string, unknown> | null;
      metadata: Record<string, unknown> | null;
    },
  >(rows: T[]) {
    return rows.map((row) => ({
      ...row,
      summary: this.buildSummary(row),
      beforeDataFriendly: this.toFriendlyData(row.beforeData),
      afterDataFriendly: this.toFriendlyData(row.afterData),
      metadataFriendly: this.toFriendlyData(row.metadata),
    }));
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

    const filters: SQL[] = [eq(auditLogs.userId, userId)];

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

    if (query.view === "grouped") {
      return await this.listGrouped(filters, page, limit, offset);
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

    const enrichedRows = this.enrichRows(rows);

    return {
      data: enrichedRows,
      page,
      limit,
      total: Number(totalRow?.count ?? 0),
    };
  }

  private async listGrouped(filters: SQL[], page: number, limit: number, offset: number) {
    const groupedKey = sql<string>`
      case
        when ${auditLogs.entityType} = 'transaction'::audit_entity_type
          and ${auditLogs.action} = 'create'::audit_action
          and (${auditLogs.metadata} ->> 'operation') = 'transfer-create'
          and (${auditLogs.metadata} ->> 'transferId') is not null
        then (${auditLogs.metadata} ->> 'transferId')
        else ${auditLogs.id}::text
      end
    `;

    const groupedPriority = sql<number>`
      case
        when (${auditLogs.metadata} ->> 'operation') = 'transfer-create'
          and (${auditLogs.metadata} ->> 'side') = 'fromAccount'
        then 0
        else 1
      end
    `;

    const [totalRow] = this.toRows<{ count: number }>(
      await this.app.db.execute(sql`
        select count(*)::int as count
        from (
          select distinct ${groupedKey} as group_key
          from ${auditLogs}
          where ${and(...filters)}
        ) grouped
      `),
    );

    type GroupedAuditRow = {
      id: string;
      userId: string;
      entityType: AuditEntityType;
      entityId: string;
      action: AuditAction;
      beforeData: Record<string, unknown> | null;
      afterData: Record<string, unknown> | null;
      metadata: Record<string, unknown> | null;
      createdAt: Date;
      groupSize: number;
    };

    const rows = this.toRows<GroupedAuditRow>(
      await this.app.db.execute(sql`
        with grouped as (
          select
            ${auditLogs.id} as id,
            ${auditLogs.userId} as "userId",
            ${auditLogs.entityType} as "entityType",
            ${auditLogs.entityId} as "entityId",
            ${auditLogs.action} as action,
            ${auditLogs.beforeData} as "beforeData",
            ${auditLogs.afterData} as "afterData",
            ${auditLogs.metadata} as metadata,
            ${auditLogs.createdAt} as "createdAt",
            row_number() over (
              partition by ${groupedKey}
              order by ${groupedPriority}, ${auditLogs.createdAt} desc, ${auditLogs.id} desc
            ) as rn,
            count(*) over (partition by ${groupedKey})::int as "groupSize"
          from ${auditLogs}
          where ${and(...filters)}
        )
        select
          id,
          "userId",
          "entityType",
          "entityId",
          action,
          "beforeData",
          "afterData",
          metadata,
          "createdAt",
          "groupSize"
        from grouped
        where rn = 1
        order by "createdAt" desc, id desc
        limit ${limit}
        offset ${offset}
      `),
    );

    const groupedRows = rows.map((row) => {
      const { groupSize, ...baseRow } = row;
      if (groupSize <= 1) {
        return baseRow;
      }

      const baseMetadata =
        baseRow.metadata && typeof baseRow.metadata === "object"
          ? (baseRow.metadata as Record<string, unknown>)
          : {};

      return {
        ...baseRow,
        metadata: {
          ...baseMetadata,
          grouped: true,
          groupSize,
        },
      };
    });

    const enrichedRows = this.enrichRows(groupedRows);

    return {
      data: enrichedRows,
      page,
      limit,
      total: Number(totalRow?.count ?? 0),
    };
  }
}
