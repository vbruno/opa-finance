import { z } from "zod";

const auditEntityTypes = ["transaction", "account", "category", "subcategory"] as const;
const auditActions = ["create", "update", "delete"] as const;

export const listAuditLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    view: z.enum(["raw", "grouped"]).default("raw"),
    entityType: z.enum(auditEntityTypes).optional(),
    action: z.enum(auditActions).optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
  })
  .refine((data) => !data.startDate || !data.endDate || data.startDate <= data.endDate, {
    message: "Data inicial não pode ser maior que a data final",
    path: ["startDate"],
  });

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
