import crypto from "crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { NotAuthorizedError, NotFoundError, ValidationError } from "../../utils/errors";
import { USER_SUMMARY_SELECT } from "../users/users.service";
import { sanitizeFileName } from "./filename";
import { deleteObject, getSignedDownloadUrl, uploadObject } from "./s3";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

async function assertStudyExists(studyId: string) {
  const study = await prisma.study.findUnique({ where: { id: studyId } });
  if (!study) throw new NotFoundError("Study");
}

async function withDownloadUrl<T extends { id: string; storageKey: string; fileName: string }>(attachment: T) {
  const url = await getSignedDownloadUrl(attachment.storageKey, attachment.fileName);
  return { ...attachment, url };
}

// Study-level only (taskId null) — a Study's own "Attachments" section,
// separate from any of its Tasks' attachments below.
export async function listStudyAttachments(studyId: string) {
  await assertStudyExists(studyId);
  const attachments = await prisma.attachment.findMany({
    where: { studyId, taskId: null },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: USER_SUMMARY_SELECT } },
  });
  return Promise.all(attachments.map(withDownloadUrl));
}

export async function listTaskAttachments(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Task");
  const attachments = await prisma.attachment.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: USER_SUMMARY_SELECT } },
  });
  return Promise.all(attachments.map(withDownloadUrl));
}

export async function uploadStudyAttachment(studyId: string, file: UploadedFile, uploadedById: string) {
  await assertStudyExists(studyId);
  return createAttachment({ studyId, taskId: null, file, uploadedById });
}

export async function uploadTaskAttachment(taskId: string, file: UploadedFile, uploadedById: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Task");
  return createAttachment({ studyId: task.studyId, taskId, file, uploadedById });
}

async function createAttachment(input: {
  studyId: string;
  taskId: string | null;
  file: UploadedFile;
  uploadedById: string;
}) {
  const { file } = input;
  if (!file) throw new ValidationError("A file is required.", { file: "Required" });
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new ValidationError(`File is too large — the limit is ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`, {
      file: "Too large",
    });
  }

  const id = crypto.randomUUID();
  const fileName = sanitizeFileName(file.originalname);
  const storageKey = `attachments/${id}/${fileName}`;

  await uploadObject(storageKey, file.buffer, file.mimetype || "application/octet-stream");

  const attachment = await prisma.attachment.create({
    data: {
      id,
      studyId: input.studyId,
      taskId: input.taskId,
      fileName,
      contentType: file.mimetype || "application/octet-stream",
      sizeBytes: file.size,
      storageKey,
      uploadedById: input.uploadedById,
    },
    include: { uploadedBy: { select: USER_SUMMARY_SELECT } },
  });

  return withDownloadUrl(attachment);
}

export async function deleteAttachment(attachmentId: string, requestingUserId: string, requestingUserRole: UserRole) {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) throw new NotFoundError("Attachment");

  if (attachment.uploadedById !== requestingUserId && requestingUserRole !== UserRole.ADMIN) {
    throw new NotAuthorizedError("You can only delete attachments you uploaded.");
  }

  await deleteObject(attachment.storageKey);
  await prisma.attachment.delete({ where: { id: attachmentId } });
}
