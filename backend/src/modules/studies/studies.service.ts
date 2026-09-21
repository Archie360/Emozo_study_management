import { Prisma, Priority, Study, StudyStatus, StudyTypeStatus, Task, TaskStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ConflictError, NotFoundError, ValidationError } from "../../utils/errors";
import { AuditAction, recordAudit } from "../audit/audit.service";
import {
  currentStudyStage,
  expectedCompletionDate,
  scheduleVarianceDays,
  studyProgressPercent,
  taskStatusSummary,
} from "../../utils/calculations";

type TxClient = Prisma.TransactionClient;

interface InlineTaskInput {
  taskName: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  sequenceNumber: number;
}

interface CreateStudyInput {
  studyName: string;
  ownerUserId: string;
  description?: string;
  clientBusinessUnit?: string;
  priority?: Priority;
  status: StudyStatus;
  originalStartDate: Date;
  originalCompletionDate: Date;
  taskCreationMethod: "STUDY_TYPE_AS_IS" | "MODIFIED_TEMPLATE" | "FROM_SCRATCH";
  studyTypeId?: string;
  tasks?: InlineTaskInput[];
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
      allTasksComplete: activeTasks.length > 0 && summary.complete === summary.total,
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
      include: { tasks: { where: { deletedAt: null } }, owner: true, studyType: true },
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
      owner: true,
      studyType: true,
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
        sequenceNumber: templateTask.sequenceNumber,
        currentStartDate: start,
        currentEndDate: end,
        status: TaskStatus.NOT_STARTED,
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
        sequenceNumber: task.sequenceNumber,
        currentStartDate: task.startDate,
        currentEndDate: task.endDate,
        status: TaskStatus.NOT_STARTED,
        dateChangeCount: 0,
        createdBy: userId,
      },
    });
  }
}

// Spec 48 "STUDY Creation From Template": create study, copy/create tasks,
// calculate expected completion — all in one transaction.
export async function createStudy(input: CreateStudyInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    const study = await tx.study.create({
      data: {
        studyName: input.studyName,
        ownerUserId: input.ownerUserId,
        description: input.description,
        clientBusinessUnit: input.clientBusinessUnit,
        priority: input.priority,
        status: input.status,
        originalStartDate: input.originalStartDate,
        originalCompletionDate: input.originalCompletionDate,
        studyTypeId: input.taskCreationMethod === "FROM_SCRATCH" ? null : input.studyTypeId,
        createdBy: userId,
      },
    });

    if (input.taskCreationMethod === "STUDY_TYPE_AS_IS") {
      await copyStudyTypeTasksAsIs(tx, study.id, input.studyTypeId!, input.originalStartDate, userId);
    } else {
      // MODIFIED_TEMPLATE and FROM_SCRATCH both arrive as an explicit task
      // list — the "modification" of the template happens client-side
      // before submission (spec 13); the server only persists the result.
      await createInlineTasks(tx, study.id, input.tasks ?? [], userId);
    }

    await recalcStudyExpectedCompletion(tx, study.id);

    await recordAudit(tx, {
      entityType: "STUDY",
      entityId: study.id,
      action: AuditAction.STUDY_CREATED,
      userId,
      newValue: { taskCreationMethod: input.taskCreationMethod, studyTypeId: input.studyTypeId },
    });

    return getStudyTx(tx, study.id);
  });
}

async function getStudyTx(tx: TxClient, id: string) {
  const study = await tx.study.findUniqueOrThrow({
    where: { id },
    include: {
      tasks: { where: { deletedAt: null }, orderBy: { sequenceNumber: "asc" } },
      owner: true,
      studyType: true,
    },
  });
  return withMetrics(study);
}

interface UpdateStudyInput {
  studyName?: string;
  ownerUserId?: string;
  description?: string;
  clientBusinessUnit?: string;
  priority?: Priority;
  version: number;
}

export async function updateStudy(id: string, input: UpdateStudyInput, userId: string) {
  const existing = await prisma.study.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Study");
  if (existing.version !== input.version) throw new ConflictError();

  // Spec 22: original_completion_date is the locked baseline once the study
  // has left DRAFT; this endpoint never accepts baseline-date changes at all,
  // by design — see `rebaselineStudy` for the separately audited exception.

  return prisma.$transaction(async (tx) => {
    const updated = await tx.study.update({
      where: { id },
      data: {
        studyName: input.studyName,
        ownerUserId: input.ownerUserId,
        description: input.description,
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

const VALID_STUDY_TRANSITIONS: Record<StudyStatus, StudyStatus[]> = {
  DRAFT: [StudyStatus.ACTIVE, StudyStatus.CANCELLED],
  ACTIVE: [StudyStatus.COMPLETE, StudyStatus.CANCELLED],
  COMPLETE: [StudyStatus.ACTIVE],
  CANCELLED: [StudyStatus.DRAFT, StudyStatus.ACTIVE],
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

  return prisma.$transaction(async (tx) => {
    const updated = await tx.study.update({
      where: { id },
      data: {
        originalStartDate: input.originalStartDate,
        originalCompletionDate: input.originalCompletionDate,
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
