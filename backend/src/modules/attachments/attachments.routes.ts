import { Request, Router } from "express";
import multer from "multer";
import { asyncHandler } from "../../utils/asyncHandler";
import { ValidationError } from "../../utils/errors";
import {
  MAX_ATTACHMENT_BYTES,
  deleteAttachment,
  listStudyAttachments,
  listTaskAttachments,
  uploadStudyAttachment,
  uploadTaskAttachment,
} from "./attachments.service";

export const attachmentsRouter = Router();

// Buffered in memory, not written to local disk — this backend has no
// persistent disk to write to anyway (Render wipes it on every
// restart/deploy), and files are streamed straight through to Supabase
// Storage.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_ATTACHMENT_BYTES } });

function requireFile(req: Request) {
  const file = req.file;
  if (!file) throw new ValidationError("A file is required.", { file: "Required" });
  return file;
}

attachmentsRouter.get(
  "/studies/:studyId/attachments",
  asyncHandler(async (req, res) => {
    res.json(await listStudyAttachments(req.params.studyId));
  })
);

attachmentsRouter.post(
  "/studies/:studyId/attachments",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const attachment = await uploadStudyAttachment(req.params.studyId, requireFile(req), req.user!.id);
    res.status(201).json(attachment);
  })
);

attachmentsRouter.get(
  "/tasks/:id/attachments",
  asyncHandler(async (req, res) => {
    res.json(await listTaskAttachments(req.params.id));
  })
);

attachmentsRouter.post(
  "/tasks/:id/attachments",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const attachment = await uploadTaskAttachment(req.params.id, requireFile(req), req.user!.id);
    res.status(201).json(attachment);
  })
);

attachmentsRouter.delete(
  "/attachments/:id",
  asyncHandler(async (req, res) => {
    await deleteAttachment(req.params.id, req.user!.id, req.user!.role);
    res.status(204).send();
  })
);
