import { StudyTypeStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ConflictError, NotFoundError, ValidationError } from "../../utils/errors";
import { AuditAction, recordAudit } from "../audit/audit.service";

interface TaskInput {
  taskName: string;
  description?: string;
  sequenceNumber: number;
  defaultDurationDays?: number;
}

async function assertNameUniqueAmongActive(name: string, excludeId?: string) {
  const existing = await prisma.studyType.findFirst({
    where: {
      name,
      status: StudyTypeStatus.ACTIVE,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  // Spec 52: STUDY TYPE name should be unique among ACTIVE types.
  if (existing) {
    throw new ValidationError("A Study Type with this name is already active.", {
      name: "Must be unique among active Study Types",
    });
  }
}

export async function listStudyTypes(status?: StudyTypeStatus) {
  return prisma.studyType.findMany({
    where: status ? { status } : undefined,
    include: { _count: { select: { tasks: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getStudyType(id: string) {
  const studyType = await prisma.studyType.findUnique({
    where: { id },
    include: { tasks: { orderBy: { sequenceNumber: "asc" } } },
  });
  if (!studyType) throw new NotFoundError("Study Type");
  return studyType;
}

export async function createStudyType(
  input: { name: string; description?: string; tasks: TaskInput[] },
  userId: string
) {
  await assertNameUniqueAmongActive(input.name);

  const sequences = new Set(input.tasks.map((t) => t.sequenceNumber));
  if (sequences.size !== input.tasks.length) {
    throw new ValidationError("Task sequence numbers must be unique within a Study Type.");
  }

  return prisma.$transaction(async (tx) => {
    const studyType = await tx.studyType.create({
      data: {
        name: input.name,
        description: input.description,
        createdBy: userId,
        tasks: { create: input.tasks },
      },
      include: { tasks: true },
    });

    await recordAudit(tx, {
      entityType: "STUDY_TYPE",
      entityId: studyType.id,
      action: AuditAction.STUDY_TYPE_CREATED,
      userId,
      newValue: studyType,
    });

    return studyType;
  });
}

export async function updateStudyType(
  id: string,
  input: { name?: string; description?: string; version: number },
  userId: string
) {
  const existing = await getStudyType(id);
  if (existing.status === StudyTypeStatus.ARCHIVED) {
    throw new ValidationError("Archived Study Types cannot be edited.");
  }
  // Spec 49: optimistic concurrency.
  if (existing.version !== input.version) {
    throw new ConflictError();
  }
  if (input.name) {
    await assertNameUniqueAmongActive(input.name, id);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.studyType.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        version: { increment: 1 },
      },
      include: { tasks: { orderBy: { sequenceNumber: "asc" } } },
    });

    await recordAudit(tx, {
      entityType: "STUDY_TYPE",
      entityId: id,
      action: AuditAction.STUDY_TYPE_UPDATED,
      userId,
      previousValue: existing,
      newValue: updated,
    });

    return updated;
  });
}

// Spec 5: archived STUDY TYPES cannot be selected for new studies; existing
// studies created from them remain unaffected. Spec 47: archive, don't delete.
export async function archiveStudyType(id: string, userId: string) {
  const existing = await getStudyType(id);

  return prisma.$transaction(async (tx) => {
    const archived = await tx.studyType.update({
      where: { id },
      data: { status: StudyTypeStatus.ARCHIVED, archivedAt: new Date(), version: { increment: 1 } },
    });

    await recordAudit(tx, {
      entityType: "STUDY_TYPE",
      entityId: id,
      action: AuditAction.STUDY_TYPE_ARCHIVED,
      userId,
      previousValue: { status: existing.status },
      newValue: { status: archived.status },
    });

    return archived;
  });
}

export async function duplicateStudyType(id: string, userId: string) {
  const source = await getStudyType(id);

  let candidateName = `${source.name} (Copy)`;
  let suffix = 2;
  while (await prisma.studyType.findFirst({ where: { name: candidateName, status: StudyTypeStatus.ACTIVE } })) {
    candidateName = `${source.name} (Copy ${suffix})`;
    suffix += 1;
  }

  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.studyType.create({
      data: {
        name: candidateName,
        description: source.description,
        createdBy: userId,
        tasks: {
          create: source.tasks.map((t) => ({
            taskName: t.taskName,
            description: t.description,
            sequenceNumber: t.sequenceNumber,
            defaultDurationDays: t.defaultDurationDays,
          })),
        },
      },
      include: { tasks: true },
    });

    await recordAudit(tx, {
      entityType: "STUDY_TYPE",
      entityId: duplicate.id,
      action: AuditAction.STUDY_TYPE_CREATED,
      userId,
      newValue: { duplicatedFrom: id },
    });

    return duplicate;
  });
}

// Spec 36: drag-and-drop reorder, sequence numbers normalized on save.
// Reordering never touches TASK/STUDY execution data (spec 65).
export async function reorderStudyTypeTasks(
  studyTypeId: string,
  order: { taskId: string; sequence: number }[],
  userId: string
) {
  const studyType = await getStudyType(studyTypeId);
  if (studyType.status === StudyTypeStatus.ARCHIVED) {
    throw new ValidationError("Archived Study Types cannot be edited.");
  }

  const validIds = new Set(studyType.tasks.map((t) => t.id));
  for (const item of order) {
    if (!validIds.has(item.taskId)) {
      throw new ValidationError(`Task ${item.taskId} does not belong to this Study Type.`);
    }
  }

  return prisma.$transaction(async (tx) => {
    // Two-phase update avoids violating the unique (studyTypeId, sequenceNumber) constraint mid-write.
    await Promise.all(
      order.map((item, index) =>
        tx.studyTypeTask.update({
          where: { id: item.taskId },
          data: { sequenceNumber: -(index + 1) },
        })
      )
    );
    await Promise.all(
      order.map((item) =>
        tx.studyTypeTask.update({
          where: { id: item.taskId },
          data: { sequenceNumber: item.sequence },
        })
      )
    );

    await tx.studyType.update({ where: { id: studyTypeId }, data: { version: { increment: 1 } } });

    await recordAudit(tx, {
      entityType: "STUDY_TYPE",
      entityId: studyTypeId,
      action: AuditAction.STUDY_TYPE_UPDATED,
      userId,
      newValue: { reordered: order },
    });

    return tx.studyTypeTask.findMany({
      where: { studyTypeId },
      orderBy: { sequenceNumber: "asc" },
    });
  });
}

interface AddTaskInput {
  taskName: string;
  description?: string;
  sequenceNumber?: number;
  defaultDurationDays?: number;
}

// Spec 35: "Add TASK" on the Study Type Edit Screen. New tasks append to
// the end unless a sequence is explicitly given.
export async function addStudyTypeTask(studyTypeId: string, input: AddTaskInput, userId: string) {
  const studyType = await getStudyType(studyTypeId);
  if (studyType.status === StudyTypeStatus.ARCHIVED) {
    throw new ValidationError("Archived Study Types cannot be edited.");
  }

  const sequenceNumber =
    input.sequenceNumber ?? Math.max(0, ...studyType.tasks.map((t) => t.sequenceNumber)) + 1;

  return prisma.$transaction(async (tx) => {
    const task = await tx.studyTypeTask.create({
      data: {
        studyTypeId,
        taskName: input.taskName,
        description: input.description,
        sequenceNumber,
        defaultDurationDays: input.defaultDurationDays,
      },
    });

    await tx.studyType.update({ where: { id: studyTypeId }, data: { version: { increment: 1 } } });

    await recordAudit(tx, {
      entityType: "STUDY_TYPE",
      entityId: studyTypeId,
      action: AuditAction.STUDY_TYPE_UPDATED,
      userId,
      newValue: { addedTask: task },
    });

    return task;
  });
}

// Spec 35: "Rename TASK" / "Edit description". Never touches execution
// data — this only affects the template, per the architectural separation
// in spec 65.
export async function updateStudyTypeTask(
  studyTypeId: string,
  taskId: string,
  input: { taskName?: string; description?: string; defaultDurationDays?: number },
  userId: string
) {
  const studyType = await getStudyType(studyTypeId);
  if (studyType.status === StudyTypeStatus.ARCHIVED) {
    throw new ValidationError("Archived Study Types cannot be edited.");
  }
  const existing = studyType.tasks.find((t) => t.id === taskId);
  if (!existing) throw new NotFoundError("Study Type Task");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.studyTypeTask.update({
      where: { id: taskId },
      data: {
        taskName: input.taskName,
        description: input.description,
        defaultDurationDays: input.defaultDurationDays,
      },
    });

    await tx.studyType.update({ where: { id: studyTypeId }, data: { version: { increment: 1 } } });

    await recordAudit(tx, {
      entityType: "STUDY_TYPE",
      entityId: studyTypeId,
      action: AuditAction.STUDY_TYPE_UPDATED,
      userId,
      previousValue: existing,
      newValue: updated,
    });

    return updated;
  });
}

// Spec 35: "Delete TASK". Study Type tasks are pure template rows with no
// execution history, so a hard delete is safe (contrast with spec 37-38's
// soft-delete requirement for execution TASKS).
export async function deleteStudyTypeTask(studyTypeId: string, taskId: string, userId: string) {
  const studyType = await getStudyType(studyTypeId);
  if (studyType.status === StudyTypeStatus.ARCHIVED) {
    throw new ValidationError("Archived Study Types cannot be edited.");
  }
  const existing = studyType.tasks.find((t) => t.id === taskId);
  if (!existing) throw new NotFoundError("Study Type Task");

  return prisma.$transaction(async (tx) => {
    await tx.studyTypeTask.delete({ where: { id: taskId } });
    await tx.studyType.update({ where: { id: studyTypeId }, data: { version: { increment: 1 } } });

    await recordAudit(tx, {
      entityType: "STUDY_TYPE",
      entityId: studyTypeId,
      action: AuditAction.STUDY_TYPE_UPDATED,
      userId,
      previousValue: { deletedTask: existing },
    });
  });
}
