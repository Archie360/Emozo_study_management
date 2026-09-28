import { Prisma, Priority, Study, StudyStatus, StudyTypeStatus, Task, TaskStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ConflictError, NotFoundError, ValidationError } from "../../utils/errors";
import { AuditAction, recordAudit } from "../audit/audit.service";
import { USER_SUMMARY_SELECT } from "../users/users.service";
import {
  currentStudyStage,
  expectedCompletionDate,
  scheduleVarianceDays,
  studyProgressPercent,
  taskStatusSummary,
} from "../../utils/calculations";

type TxClient = Prisma.TransactionClient;

// Shared across every query that returns a Study to an HTTP response —
// `owner: true` would otherwise pull passwordHash along with the rest of
// the User row. (emozoPoc is free text, not a User relation.)
const STUDY_USER_RELATIONS = {
  owner: { select: USER_SUMMARY_SELECT },
  studyType: true,
} as const;

interface InlineTaskInput {
  taskName: string;
  description?: string;
  groupName?: string;
  startDate: Date;
  endDate: Date;
  sequenceNumber: number;
  isFixed?: boolean;
}

type TaskCreationMethod = "STUDY_TYPE_AS_IS" | "MODIFIED_TEMPLATE" | "FROM_SCRATCH";

// A Study is defined first (PROPOSED) with no tasks; tasks are only
// instantiated later, when it's confirmed sold (see confirmStudySold).
interface CreateStudyInput {
  studyName: string;
  studyTypeId: string;
  ownerUserId: string;
  emozoPoc?: string;
  description?: string;
  clientName?: string;
  clientLocation?: string;
  sponsorInfo?: string;
  clientBusinessUnit?: string;
  priority?: Priority;
  originalStartDate: Date;
  originalCompletionDate: Date;
  likelyTotalRevenue?: number;
  estimatedTotalExpenses?: number;
}

// Recomputes and persists the study's calculated expected completion date
// (spec 16 step 6, spec 21). Called inside the same transaction as any
// task date/status mutation so the two never drift apart.
export async function recalcStudyExpectedCompletion(tx: TxClient, studyId: string) {
  const tasks = await tx.task.findMany({ where: { studyId, deletedAt: null } });
  const expected = expectedCompletionDate(tasks);
  await tx.study.update({
    where: { id: studyId },
    data: { currentExpectedCompletionDate: expected },
  });
  return expected;
}

// Callers must pass `tasks` already filtered to `deletedAt: null` (spec 38 —
// soft-deleted tasks are excluded from normal queries). Generic `T` (rather
// than a fixed `Study & { tasks: Task[] }` parameter type) preserves
// whatever extra relations (owner, studyType, ...) the caller included.
function withMetrics<T extends Study & { tasks: Task[] }>(study: T) {
  const activeTasks = study.tasks;
  const summary = taskStatusSummary(activeTasks);
  return {
    ...study,
    metrics: {
      progressPercent: studyProgressPercent(activeTasks),
      currentStage: currentStudyStage(activeTasks),
      taskStatusSummary: summary,
      scheduleVarianceDays: scheduleVarianceDays(
        study.currentExpectedCompletionDate,
        study.originalCompletionDate
      ),
      allTasksComplete: summary.total > 0 && summary.complete === summary.total,
    },
  };
}

export interface StudyListFilters {
  status?: StudyStatus;
  ownerId?: string;
  studyTypeId?: string;
  priority?: Priority;
  completionFrom?: Date;
  completionTo?: Date;
  search?: string;
  page: number;
  pageSize: number;
  sort?: string;
}

const SORTABLE_FIELDS: Record<string, string> = {
  study_name: "studyName",
  expected_completion: "currentExpectedCompletionDate",
  owner: "ownerUserId",
  priority: "priority",
  last_updated: "updatedAt",
};

// Spec 27-30: dashboard/list queries with filtering, search and sorting.
export async function listStudies(filters: StudyListFilters) {
  const where: Prisma.StudyWhereInput = {
    status: filters.status,
    ownerUserId: filters.ownerId,
    studyTypeId: filters.studyTypeId,
    priority: filters.priority,
    currentExpectedCompletionDate: {
      gte: filters.completionFrom,
      lte: filters.completionTo,
    },
    OR: filters.search
      ? [
          { studyName: { contains: filters.search, mode: "insensitive" } },
          { id: filters.search },
        ]
      : undefined,
  };

  const [field, direction] = (filters.sort ?? "last_updated:desc").split(":");
  const orderField = SORTABLE_FIELDS[field] ?? "updatedAt";

  const [total, studies] = await prisma.$transaction([
    prisma.study.count({ where }),
    prisma.study.findMany({
      where,
      include: { tasks: { where: { deletedAt: null } }, ...STUDY_USER_RELATIONS },
      orderBy: { [orderField]: direction === "asc" ? "asc" : "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  return {
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    items: studies.map(withMetrics),
  };
}

export async function getStudy(id: string) {
  const study = await prisma.study.findUnique({
    where: { id },
    include: {
      tasks: { where: { deletedAt: null }, orderBy: { sequenceNumber: "asc" } },
      ...STUDY_USER_RELATIONS,
    },
  });
  if (!study) throw new NotFoundError("Study");
  return withMetrics(study);
}

async function copyStudyTypeTasksAsIs(
  tx: TxClient,
  studyId: string,
  studyTypeId: string,
  originalStartDate: Date,
  userId: string
) {
  const studyType = await tx.studyType.findUnique({
    where: { id: studyTypeId },
    include: { tasks: { orderBy: { sequenceNumber: "asc" } } },
  });
  if (!studyType) throw new NotFoundError("Study Type");
  if (studyType.status === StudyTypeStatus.ARCHIVED) {
    throw new ValidationError("This Study Type is archived and cannot be used for new Studies.");
  }

  // Chain task dates sequentially from the study's original start date using
  // each template task's default_duration_days (spec 12: "Sets initial TASK
  // dates" — the spec does not prescribe an exact algorithm, so this is a
  // documented, deterministic default that keeps tasks non-overlapping).
  let cursor = new Date(originalStartDate);
  for (const templateTask of studyType.tasks) {
    const durationDays = templateTask.defaultDurationDays ?? 1;
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + Math.max(durationDays - 1, 0));

    await tx.task.create({
      data: {
        studyId,
        sourceStudyTypeTaskId: templateTask.id,
        taskName: templateTask.taskName,
        description: templateTask.description,
        groupName: templateTask.groupName,
        sequenceNumber: templateTask.sequenceNumber,
        currentStartDate: start,
        currentEndDate: end,
        status: TaskStatus.NOT_STARTED,
        isFixed: templateTask.isFixed,
        dateChangeCount: 0,
        createdBy: userId,
      },
    });

    cursor = new Date(end);
    cursor.setDate(cursor.getDate() + 1);
  }
}

async function createInlineTasks(
  tx: TxClient,
  studyId: string,
  tasks: InlineTaskInput[],
  userId: string
) {
  const sequences = new Set(tasks.map((t) => t.sequenceNumber));
  if (sequences.size !== tasks.length) {
    throw new ValidationError("Task sequence numbers must be unique within a Study.");
  }

  for (const task of tasks) {
    if (task.endDate < task.startDate) {
      throw new ValidationError("Task End Date cannot be earlier than Task Start Date.", {
        endDate: "Must be on or after the start date",
      });
    }
    await tx.task.create({
      data: {
        studyId,
        taskName: task.taskName,
        description: task.description,
        groupName: task.groupName,
        sequenceNumber: task.sequenceNumber,
        currentStartDate: task.startDate,
        currentEndDate: task.endDate,
        status: TaskStatus.NOT_STARTED,
        isFixed: task.isFixed ?? false,
        dateChangeCount: 0,
        createdBy: userId,
      },
    });
  }
}

// A Study is defined first as PROPOSED — info fields only, no tasks yet.
// Tasks are only instantiated once it's confirmed sold (confirmStudySold).
export async function createStudy(input: CreateStudyInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    const study = await tx.study.create({
      data: {
        studyName: input.studyName,
        studyTypeId: input.studyTypeId,
        ownerUserId: input.ownerUserId,
        emozoPoc: input.emozoPoc,
        description: input.description,
        clientName: input.clientName,
        clientLocation: input.clientLocation,
        sponsorInfo: input.sponsorInfo,
        clientBusinessUnit: input.clientBusinessUnit,
        priority: input.priority,
        status: StudyStatus.PROPOSED,
        originalStartDate: input.originalStartDate,
        originalCompletionDate: input.originalCompletionDate,
        likelyTotalRevenue: input.likelyTotalRevenue,
        estimatedTotalExpenses: input.estimatedTotalExpenses,
        createdBy: userId,
      },
    });

    await recordAudit(tx, {
      entityType: "STUDY",
      entityId: study.id,
      action: AuditAction.STUDY_CREATED,
      userId,
      newValue: { studyTypeId: input.studyTypeId },
    });

    return getStudyTx(tx, study.id);
  });
}

interface ConfirmStudySoldInput {
  taskCreationMethod: TaskCreationMethod;
  studyTypeId?: string;
  tasks?: InlineTaskInput[];
  version: number;
}

// Once a Study is CONFIRMED_SOLD, the rest of its tasks get instantiated
// from the appropriate template — this is that transition. Re-confirming a
// Study that was CANCELLED after already having tasks is a no-op on tasks
// (they're left as-is); only a Study with zero tasks gets them created.
export async function confirmStudySold(id: string, input: ConfirmStudySoldInput, userId: string) {
  const existing = await prisma.study.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Study");
  if (existing.version !== input.version) throw new ConflictError();
  if (existing.status !== StudyStatus.PROPOSED) {
    throw new ValidationError("Only a Study with status PROPOSED can be confirmed as sold.");
  }
  if (!existing.originalStartDate) {
    throw new ValidationError("Original Start Date is required before confirming a Study as sold.");
  }

  return prisma.$transaction(async (tx) => {
    const existingTaskCount = await tx.task.count({ where: { studyId: id, deletedAt: null } });

    if (existingTaskCount === 0) {
      if (input.taskCreationMethod === "STUDY_TYPE_AS_IS") {
        const studyTypeId = input.studyTypeId ?? existing.studyTypeId;
        if (!studyTypeId) {
          throw new ValidationError("A Study Type must be selected for this task creation method.");
        }
        await copyStudyTypeTasksAsIs(tx, id, studyTypeId, existing.originalStartDate!, userId);
      } else {
        // MODIFIED_TEMPLATE and FROM_SCRATCH both arrive as an explicit task
        // list — the "modification" of the template happens client-side
        // before submission (spec 13); the server only persists the result.
        await createInlineTasks(tx, id, input.tasks ?? [], userId);
      }
    }

    await recalcStudyExpectedCompletion(tx, id);

    const updated = await tx.study.update({
      where: { id },
      data: { status: StudyStatus.CONFIRMED_SOLD, version: { increment: 1 } },
    });

    await recordAudit(tx, {
      entityType: "STUDY",
      entityId: id,
      action: AuditAction.STUDY_STATUS_CHANGED,
      userId,
      previousValue: { status: existing.status },
      newValue: { status: updated.status, taskCreationMethod: input.taskCreationMethod },
    });

    return getStudyTx(tx, id);
  });
}

async function getStudyTx(tx: TxClient, id: string) {
  const study = await tx.study.findUniqueOrThrow({
    where: { id },
    include: {
      tasks: { where: { deletedAt: null }, orderBy: { sequenceNumber: "asc" } },
      ...STUDY_USER_RELATIONS,
    },
  });
  return withMetrics(study);
}

interface UpdateStudyInput {
  studyName?: string;
  ownerUserId?: string;
  emozoPoc?: string;
  description?: string;
  clientName?: string;
  clientLocation?: string;
  sponsorInfo?: string;
  clientBusinessUnit?: string;
  priority?: Priority;
  version: number;
}

export async function updateStudy(id: string, input: UpdateStudyInput, userId: string) {
  const existing = await prisma.study.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Study");
  if (existing.version !== input.version) throw new ConflictError();

  // Spec 22: original_completion_date is the locked baseline once the study
  // has left PROPOSED; this endpoint never accepts baseline-date changes at
  // all, by design — see `rebaselineStudy` for the separately audited
  // exception, and `updateStudyEstimates` for revenue/expenses.

  return prisma.$transaction(async (tx) => {
    const updated = await tx.study.update({
      where: { id },
      data: {
        studyName: input.studyName,
        ownerUserId: input.ownerUserId,
        emozoPoc: input.emozoPoc,
        description: input.description,
        clientName: input.clientName,
        clientLocation: input.clientLocation,
        sponsorInfo: input.sponsorInfo,
        clientBusinessUnit: input.clientBusinessUnit,
        priority: input.priority,
        version: { increment: 1 },
      },
    });

    await recordAudit(tx, {
      entityType: "STUDY",
      entityId: id,
      action: AuditAction.STUDY_UPDATED,
      userId,
      previousValue: existing,
      newValue: updated,
    });

    return getStudyTx(tx, id);
  });
}

// PROPOSED -> CONFIRMED_SOLD only happens through confirmStudySold (it needs
// a task-creation method), so it's deliberately absent here.
const VALID_STUDY_TRANSITIONS: Record<StudyStatus, StudyStatus[]> = {
  PROPOSED: [StudyStatus.CANCELLED],
  CONFIRMED_SOLD: [StudyStatus.COMPLETE, StudyStatus.CANCELLED],
  COMPLETE: [StudyStatus.CONFIRMED_SOLD],
  CANCELLED: [StudyStatus.PROPOSED, StudyStatus.CONFIRMED_SOLD],
};

// Spec 19-20: status is user-driven, never auto-set. The UI is expected to
// prompt "Mark this Study as Complete?" when metrics.allTasksComplete is
// true; this endpoint just enforces the transition is coherent.
export async function changeStudyStatus(
  id: string,
  input: { status: StudyStatus; version: number },
  userId: string
) {
  const existing = await prisma.study.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Study");
  if (existing.version !== input.version) throw new ConflictError();

  if (existing.status === input.status) {
    return getStudy(id);
  }

  if (!VALID_STUDY_TRANSITIONS[existing.status].includes(input.status)) {
    throw new ValidationError(
      `Cannot change Study status from ${existing.status} to ${input.status}.`
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.study.update({
      where: { id },
      data: {
        status: input.status,
        completedAt: input.status === StudyStatus.COMPLETE ? new Date() : null,
        version: { increment: 1 },
      },
    });

    await recordAudit(tx, {
      entityType: "STUDY",
      entityId: id,
      action: AuditAction.STUDY_STATUS_CHANGED,
      userId,
      previousValue: { status: existing.status },
      newValue: { status: updated.status },
    });

    return getStudyTx(tx, id);
  });
}

// Spec 44: copy STUDY task structure into a brand-new STUDY TYPE. Only
// name/description/sequence are copied — never dates, status or history.
export async function saveStudyAsStudyType(
  studyId: string,
  input: { name: string; description?: string },
  userId: string
) {
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    include: { tasks: { where: { deletedAt: null }, orderBy: { sequenceNumber: "asc" } } },
  });
  if (!study) throw new NotFoundError("Study");

  const existingName = await prisma.studyType.findFirst({
    where: { name: input.name, status: StudyTypeStatus.ACTIVE },
  });
  if (existingName) {
    throw new ValidationError("A Study Type with this name is already active.", {
      name: "Must be unique among active Study Types",
    });
  }

  return prisma.$transaction(async (tx) => {
    const studyType = await tx.studyType.create({
      data: {
        name: input.name,
        description: input.description,
        createdBy: userId,
        tasks: {
          create: study.tasks.map((t) => ({
            taskName: t.taskName,
            description: t.description,
            sequenceNumber: t.sequenceNumber,
          })),
        },
      },
      include: { tasks: true },
    });

    await recordAudit(tx, {
      entityType: "STUDY_TYPE",
      entityId: studyType.id,
      action: AuditAction.STUDY_TYPE_CREATED,
      userId,
      newValue: { createdFromStudyId: studyId },
    });

    return studyType;
  });
}

// Spec 22: "If administrators need to change the baseline in future, that
// should be a separately audited operation." This is that operation —
// deliberately not reachable from the ordinary `updateStudy` path.
export async function rebaselineStudy(
  id: string,
  input: { originalStartDate: Date; originalCompletionDate: Date; version: number; reason: string },
  userId: string
) {
  const existing = await prisma.study.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Study");
  if (existing.version !== input.version) throw new ConflictError();
  if (input.originalCompletionDate < input.originalStartDate) {
    throw new ValidationError("Original Completion Date cannot be earlier than Original Start Date.");
  }
  if (!input.reason?.trim()) {
    throw new ValidationError("A reason is required to change a Study's baseline schedule.", {
      reason: "Required",
    });
  }

  // "Every task/timeline estimate reflects the latest value, the last set
  // of values, and total number of times it's changed" — same treatment as
  // task dates get, tracked directly on the Study.
  const startChanged =
    !existing.originalStartDate ||
    existing.originalStartDate.getTime() !== input.originalStartDate.getTime();
  const completionChanged =
    !existing.originalCompletionDate ||
    existing.originalCompletionDate.getTime() !== input.originalCompletionDate.getTime();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.study.update({
      where: { id },
      data: {
        originalStartDate: input.originalStartDate,
        previousOriginalStartDate: startChanged ? existing.originalStartDate : undefined,
        originalStartDateChangeCount: startChanged ? { increment: 1 } : undefined,
        originalCompletionDate: input.originalCompletionDate,
        previousOriginalCompletionDate: completionChanged ? existing.originalCompletionDate : undefined,
        originalCompletionDateChangeCount: completionChanged ? { increment: 1 } : undefined,
        version: { increment: 1 },
      },
    });

    await recordAudit(tx, {
      entityType: "STUDY",
      entityId: id,
      action: AuditAction.STUDY_BASELINE_CHANGED,
      userId,
      previousValue: {
        originalStartDate: existing.originalStartDate,
        originalCompletionDate: existing.originalCompletionDate,
      },
      newValue: {
        originalStartDate: updated.originalStartDate,
        originalCompletionDate: updated.originalCompletionDate,
        reason: input.reason,
      },
    });

    return getStudyTx(tx, id);
  });
}

// Same "current + previous + change count" treatment as timeline dates,
// for the financial estimates collected when a Study is first proposed.
export async function updateStudyEstimates(
  id: string,
  input: { likelyTotalRevenue?: number; estimatedTotalExpenses?: number; version: number },
  userId: string
) {
  const existing = await prisma.study.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Study");
  if (existing.version !== input.version) throw new ConflictError();

  const previousRevenue = existing.likelyTotalRevenue !== null ? Number(existing.likelyTotalRevenue) : null;
  const revenueChanged =
    input.likelyTotalRevenue !== undefined && previousRevenue !== input.likelyTotalRevenue;

  const previousExpenses =
    existing.estimatedTotalExpenses !== null ? Number(existing.estimatedTotalExpenses) : null;
  const expensesChanged =
    input.estimatedTotalExpenses !== undefined && previousExpenses !== input.estimatedTotalExpenses;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.study.update({
      where: { id },
      data: {
        likelyTotalRevenue: input.likelyTotalRevenue,
        previousTotalRevenue: revenueChanged ? existing.likelyTotalRevenue : undefined,
        totalRevenueChangeCount: revenueChanged ? { increment: 1 } : undefined,
        estimatedTotalExpenses: input.estimatedTotalExpenses,
        previousTotalExpenses: expensesChanged ? existing.estimatedTotalExpenses : undefined,
        totalExpensesChangeCount: expensesChanged ? { increment: 1 } : undefined,
        version: { increment: 1 },
      },
    });

    await recordAudit(tx, {
      entityType: "STUDY",
      entityId: id,
      action: AuditAction.STUDY_UPDATED,
      userId,
      previousValue: {
        likelyTotalRevenue: existing.likelyTotalRevenue,
        estimatedTotalExpenses: existing.estimatedTotalExpenses,
      },
      newValue: {
        likelyTotalRevenue: updated.likelyTotalRevenue,
        estimatedTotalExpenses: updated.estimatedTotalExpenses,
      },
    });

    return getStudyTx(tx, id);
  });
}
