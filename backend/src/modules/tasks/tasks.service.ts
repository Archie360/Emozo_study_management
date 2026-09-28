import { TaskStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ConflictError, NotFoundError, ValidationError } from "../../utils/errors";
import { AuditAction, recordAudit } from "../audit/audit.service";
import { recalcStudyExpectedCompletion } from "../studies/studies.service";

interface CreateTaskInput {
  taskName: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  sequenceNumber?: number;
}

// Spec 15: TASK Creation Rules.
export async function createTask(studyId: string, input: CreateTaskInput, userId: string) {
  const study = await prisma.study.findUnique({ where: { id: studyId } });
  if (!study) throw new NotFoundError("Study");

  return prisma.$transaction(async (tx) => {
    let sequenceNumber = input.sequenceNumber;
    if (!sequenceNumber) {
      const max = await tx.task.aggregate({
        where: { studyId, deletedAt: null },
        _max: { sequenceNumber: true },
      });
      sequenceNumber = (max._max.sequenceNumber ?? 0) + 1;
    }

    const task = await tx.task.create({
      data: {
        studyId,
        taskName: input.taskName,
        description: input.description,
        sequenceNumber,
        currentStartDate: input.startDate,
        currentEndDate: input.endDate,
        status: TaskStatus.NOT_STARTED,
        dateChangeCount: 0,
        createdBy: userId,
      },
    });

    await recalcStudyExpectedCompletion(tx, studyId);

    await recordAudit(tx, {
      entityType: "TASK",
      entityId: task.id,
      action: AuditAction.TASK_CREATED,
      userId,
      newValue: task,
    });

    return task;
  });
}

export async function getTask(id: string) {
  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    include: {
      study: true,
      dateHistory: { orderBy: { versionNumber: "desc" } },
      statusHistory: { orderBy: { changedAt: "desc" } },
    },
  });
  if (!task) throw new NotFoundError("Task");

  // Spec 33: Previous dates come from the most recent history record, or
  // blank if none exist yet.
  const mostRecent = task.dateHistory[0];
  return {
    ...task,
    previousStartDate: mostRecent?.previousStartDate ?? null,
    previousEndDate: mostRecent?.previousEndDate ?? null,
  };
}

export async function listTasksForStudy(studyId: string) {
  return prisma.task.findMany({
    where: { studyId, deletedAt: null },
    orderBy: { sequenceNumber: "asc" },
  });
}

interface UpdateTaskInput {
  taskName?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  version: number;
}

// Spec 16-17: TASK Date Editing. Only a genuine change to start or end date
// creates history / increments the counter; a save with unchanged dates
// must not. Both fields changing together still counts as ONE event.
export async function updateTask(id: string, input: UpdateTaskInput, userId: string) {
  const existing = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Task");
  if (existing.version !== input.version) throw new ConflictError();

  const nextStart = input.startDate ?? existing.currentStartDate;
  const nextEnd = input.endDate ?? existing.currentEndDate;

  if (nextEnd < nextStart) {
    throw new ValidationError("Task End Date cannot be earlier than Task Start Date.", {
      endDate: "Must be on or after the start date",
    });
  }

  const datesChanged =
    nextStart.getTime() !== existing.currentStartDate.getTime() ||
    nextEnd.getTime() !== existing.currentEndDate.getTime();

  return prisma.$transaction(async (tx) => {
    if (datesChanged) {
      await tx.taskDateHistory.create({
        data: {
          taskId: id,
          previousStartDate: existing.currentStartDate,
          previousEndDate: existing.currentEndDate,
          newStartDate: nextStart,
          newEndDate: nextEnd,
          versionNumber: existing.dateChangeCount + 1,
          changedBy: userId,
        },
      });
    }

    const updated = await tx.task.update({
      where: { id },
      data: {
        taskName: input.taskName,
        description: input.description,
        currentStartDate: nextStart,
        currentEndDate: nextEnd,
        dateChangeCount: datesChanged ? { increment: 1 } : undefined,
        version: { increment: 1 },
      },
    });

    if (datesChanged) {
      await recalcStudyExpectedCompletion(tx, existing.studyId);
      await recordAudit(tx, {
        entityType: "TASK",
        entityId: id,
        action: AuditAction.TASK_DATE_CHANGED,
        userId,
        previousValue: {
          startDate: existing.currentStartDate,
          endDate: existing.currentEndDate,
        },
        newValue: { startDate: nextStart, endDate: nextEnd },
      });
    } else {
      await recordAudit(tx, {
        entityType: "TASK",
        entityId: id,
        action: AuditAction.TASK_UPDATED,
        userId,
        previousValue: existing,
        newValue: updated,
      });
    }

    return updated;
  });
}

// Spec 18: valid TASK status transitions, including the explicitly permitted
// backwards ones. A direct COMPLETE -> NOT_STARTED jump is not listed, so it
// is rejected — callers should route through IN_PROGRESS. NOT_APPLICABLE is
// reachable from either not-yet-done state and reversible back to NOT_STARTED.
const VALID_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  NOT_STARTED: [TaskStatus.IN_PROGRESS, TaskStatus.COMPLETE, TaskStatus.NOT_APPLICABLE],
  IN_PROGRESS: [TaskStatus.COMPLETE, TaskStatus.NOT_STARTED, TaskStatus.NOT_APPLICABLE],
  COMPLETE: [TaskStatus.IN_PROGRESS],
  NOT_APPLICABLE: [TaskStatus.NOT_STARTED],
};

export async function changeTaskStatus(
  id: string,
  input: { status: TaskStatus; version: number },
  userId: string
) {
  const existing = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Task");
  if (existing.version !== input.version) throw new ConflictError();

  // Spec 10: saving without changing status must not create a history record.
  if (existing.status === input.status) {
    return existing;
  }

  if (!VALID_TASK_TRANSITIONS[existing.status].includes(input.status)) {
    throw new ValidationError(
      `Cannot change Task status from ${existing.status} to ${input.status}.`
    );
  }

  if (input.status === TaskStatus.NOT_APPLICABLE && existing.isFixed) {
    throw new ValidationError("This task is fixed and cannot be marked Not Applicable.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.taskStatusHistory.create({
      data: {
        taskId: id,
        previousStatus: existing.status,
        newStatus: input.status,
        changedBy: userId,
      },
    });

    const updated = await tx.task.update({
      where: { id },
      data: {
        status: input.status,
        // Spec 18: set completed_at on completion, clear it if reopened.
        completedAt: input.status === TaskStatus.COMPLETE ? new Date() : null,
        version: { increment: 1 },
      },
    });

    await recalcStudyExpectedCompletion(tx, existing.studyId);

    await recordAudit(tx, {
      entityType: "TASK",
      entityId: id,
      action: AuditAction.TASK_STATUS_CHANGED,
      userId,
      previousValue: { status: existing.status },
      newValue: { status: updated.status },
    });

    return updated;
  });
}

// Spec 37-38: soft delete pattern; TASK history remains available for audit.
export async function deleteTask(id: string, userId: string) {
  const existing = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Task");

  return prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId },
    });

    await recalcStudyExpectedCompletion(tx, existing.studyId);

    await recordAudit(tx, {
      entityType: "TASK",
      entityId: id,
      action: AuditAction.TASK_DELETED,
      userId,
      previousValue: existing,
    });
  });
}

// Spec 36: drag-and-drop reorder; sequence numbers normalized on save;
// reordering must NOT count as a date change or create date history.
export async function reorderTasks(
  studyId: string,
  order: { taskId: string; sequence: number }[],
  userId: string
) {
  const tasks = await prisma.task.findMany({ where: { studyId, deletedAt: null } });
  const validIds = new Set(tasks.map((t) => t.id));
  for (const item of order) {
    if (!validIds.has(item.taskId)) {
      throw new ValidationError(`Task ${item.taskId} does not belong to this Study.`);
    }
  }

  return prisma.$transaction(async (tx) => {
    await Promise.all(
      order.map((item) =>
        tx.task.update({
          where: { id: item.taskId },
          data: { sequenceNumber: item.sequence, version: { increment: 1 } },
        })
      )
    );

    await recordAudit(tx, {
      entityType: "STUDY",
      entityId: studyId,
      action: AuditAction.TASK_UPDATED,
      userId,
      newValue: { reordered: order },
    });

    return tx.task.findMany({
      where: { studyId, deletedAt: null },
      orderBy: { sequenceNumber: "asc" },
    });
  });
}
