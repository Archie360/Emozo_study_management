import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { NotAuthorizedError, NotFoundError, ValidationError } from "../../utils/errors";
import { USER_SUMMARY_SELECT } from "../users/users.service";

async function assertTaskExists(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Task");
}

// Oldest first — a comment thread reads top-to-bottom like a conversation,
// unlike the history tables (which are newest-first changelogs).
export async function listTaskComments(taskId: string) {
  await assertTaskExists(taskId);
  return prisma.taskComment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: USER_SUMMARY_SELECT } },
  });
}

export async function addTaskComment(taskId: string, body: string, authorId: string) {
  await assertTaskExists(taskId);
  if (!body.trim()) throw new ValidationError("Comment cannot be empty.", { body: "Required" });

  return prisma.taskComment.create({
    data: { taskId, authorId, body: body.trim() },
    include: { author: { select: USER_SUMMARY_SELECT } },
  });
}

export async function deleteTaskComment(taskId: string, commentId: string, requestingUserId: string, requestingUserRole: UserRole) {
  const comment = await prisma.taskComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.taskId !== taskId) throw new NotFoundError("Comment");

  if (comment.authorId !== requestingUserId && requestingUserRole !== UserRole.ADMIN) {
    throw new NotAuthorizedError("You can only delete your own comments.");
  }

  await prisma.taskComment.delete({ where: { id: commentId } });
}
