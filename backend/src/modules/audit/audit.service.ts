import { Prisma, PrismaClient } from "@prisma/client";

// Actions enumerated in spec section 10 (non-exhaustive by design — the
// column is a plain string so new action types don't require a migration).
export const AuditAction = {
  STUDY_CREATED: "STUDY_CREATED",
  STUDY_UPDATED: "STUDY_UPDATED",
  STUDY_STATUS_CHANGED: "STUDY_STATUS_CHANGED",
  STUDY_BASELINE_CHANGED: "STUDY_BASELINE_CHANGED",
  TASK_CREATED: "TASK_CREATED",
  TASK_UPDATED: "TASK_UPDATED",
  TASK_DELETED: "TASK_DELETED",
  TASK_DATE_CHANGED: "TASK_DATE_CHANGED",
  TASK_STATUS_CHANGED: "TASK_STATUS_CHANGED",
  STUDY_TYPE_CREATED: "STUDY_TYPE_CREATED",
  STUDY_TYPE_UPDATED: "STUDY_TYPE_UPDATED",
  STUDY_TYPE_DELETED: "STUDY_TYPE_DELETED",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

interface RecordAuditParams {
  entityType: string;
  entityId: string;
  action: AuditActionType;
  userId: string;
  previousValue?: unknown;
  newValue?: unknown;
}

// Audit records are immutable (spec 10): this module only ever inserts.
// Accepts a transaction client so audit writes join the same transaction
// as the operation they describe (spec 48).
export async function recordAudit(
  client: PrismaClient | Prisma.TransactionClient,
  params: RecordAuditParams
) {
  await client.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      userId: params.userId,
      previousValue: params.previousValue as Prisma.InputJsonValue,
      newValue: params.newValue as Prisma.InputJsonValue,
    },
  });
}
