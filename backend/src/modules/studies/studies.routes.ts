import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../utils/asyncHandler";
import { parseOrThrow } from "../../utils/validate";
import { requireRole } from "../../middleware/authorize";
import {
  changeStudyStatus,
  createStudy,
  getStudy,
  listStudies,
  rebaselineStudy,
  saveStudyAsStudyType,
  updateStudy,
} from "./studies.service";
import {
  changeStudyStatusSchema,
  createStudySchema,
  createStudyTypeFromStudySchema,
  studyListQuerySchema,
  updateStudySchema,
} from "./studies.validation";
import { z } from "zod";

export const studiesRouter = Router();

// Spec 40: GET /api/v1/studies
studiesRouter.get(
  "/studies",
  asyncHandler(async (req, res) => {
    const q = parseOrThrow(studyListQuerySchema, req.query);
    const result = await listStudies({
      status: q.status,
      ownerId: q.owner_id,
      studyTypeId: q.study_type_id,
      priority: q.priority,
      completionFrom: q.completion_from,
      completionTo: q.completion_to,
      search: q.search,
      page: q.page,
      pageSize: q.page_size,
      sort: q.sort,
    });
    res.json(result);
  })
);

studiesRouter.get(
  "/studies/:id",
  asyncHandler(async (req, res) => {
    res.json(await getStudy(req.params.id));
  })
);

// Spec 11-15, 40: two-stage Create Study flow, submitted as one call.
studiesRouter.post(
  "/studies",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(createStudySchema, req.body);
    const study = await createStudy(input, req.user!.id);
    res.status(201).json(study);
  })
);

studiesRouter.patch(
  "/studies/:id",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(updateStudySchema, req.body);
    res.json(await updateStudy(req.params.id, input, req.user!.id));
  })
);

// Spec 40: POST /api/v1/studies/{id}/status
studiesRouter.post(
  "/studies/:id/status",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(changeStudyStatusSchema, req.body);
    res.json(await changeStudyStatus(req.params.id, input, req.user!.id));
  })
);

// Spec 44: POST /api/v1/studies/{study_id}/create-study-type
studiesRouter.post(
  "/studies/:id/create-study-type",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(createStudyTypeFromStudySchema, req.body);
    const studyType = await saveStudyAsStudyType(req.params.id, input, req.user!.id);
    res.status(201).json(studyType);
  })
);

// Spec 22: baseline changes are Administrator-only and separately audited.
const rebaselineSchema = z.object({
  originalStartDate: z.coerce.date(),
  originalCompletionDate: z.coerce.date(),
  version: z.number().int(),
  reason: z.string().min(1),
});

studiesRouter.post(
  "/studies/:id/rebaseline",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(rebaselineSchema, req.body);
    res.json(await rebaselineStudy(req.params.id, input, req.user!.id));
  })
);
