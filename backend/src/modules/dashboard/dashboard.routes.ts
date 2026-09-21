import { Router } from "express";
import { z } from "zod";
import { Priority } from "@prisma/client";
import { asyncHandler } from "../../utils/asyncHandler";
import { parseOrThrow } from "../../utils/validate";
import { getActiveStudiesReport } from "./dashboard.service";

export const dashboardRouter = Router();

// Spec 28-29: minimum dashboard filters and sort options.
const dashboardQuerySchema = z.object({
  owner_id: z.string().uuid().optional(),
  study_type_id: z.string().uuid().optional(),
  priority: z.nativeEnum(Priority).optional(),
  completion_from: z.coerce.date().optional(),
  completion_to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(200).default(25),
  sort: z.string().optional(),
});

// Spec 45: GET /api/v1/reports/active-studies
dashboardRouter.get(
  "/reports/active-studies",
  asyncHandler(async (req, res) => {
    const q = parseOrThrow(dashboardQuerySchema, req.query);
    const report = await getActiveStudiesReport({
      ownerId: q.owner_id,
      studyTypeId: q.study_type_id,
      priority: q.priority,
      completionFrom: q.completion_from,
      completionTo: q.completion_to,
      page: q.page,
      pageSize: q.page_size,
      sort: q.sort,
    });
    res.json(report);
  })
);
