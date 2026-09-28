import { prisma } from "../../config/prisma";
import { NotFoundError } from "../../utils/errors";
import { USER_SUMMARY_SELECT } from "../users/users.service";

async function assertTaskExists(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Task");
}

// Spec 42/32: GET /api/v1/tasks/{task_id}/date-history — newest first.
export async function getTaskDateHistory(taskId: string) {
  await assertTaskExists(taskId);
  return prisma.taskDateHistory.findMany({
    where: { taskId },
    orderBy: { versionNumber: "desc" },
    include: { changer: { select: USER_SUMMARY_SELECT } },
  });
}

// Spec 42/32: GET /api/v1/tasks/{task_id}/status-history — newest first.
export async function getTaskStatusHistory(taskId: string) {
  await assertTaskExists(taskId);
  return prisma.taskStatusHistory.findMany({
    where: { taskId },
    orderBy: { changedAt: "desc" },
    include: { changer: { select: USER_SUMMARY_SELECT } },
  });
}
