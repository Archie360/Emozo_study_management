import { Router } from "express";
import { StudyTypeStatus } from "@prisma/client";
import { asyncHandler } from "../../utils/asyncHandler";
import { parseOrThrow } from "../../utils/validate";
import { requireRole } from "../../middleware/authorize";
import { UserRole } from "@prisma/client";
import {
  addStudyTypeTask,
  createStudyType,
  deleteStudyType,
  deleteStudyTypeTask,
  duplicateStudyType,
  getStudyType,
  listStudyTypes,
  reorderStudyTypeTasks,
  updateStudyType,
  updateStudyTypeTask,
} from "./studyTypes.service";
import {
  addStudyTypeTaskSchema,
  createStudyTypeSchema,
  reorderStudyTypeTasksSchema,
  updateStudyTypeSchema,
  updateStudyTypeTaskSchema,
} from "./studyTypes.validation";

export const studyTypesRouter = Router();

// Spec 43: GET /api/v1/study-types
studyTypesRouter.get(
  "/study-types",
  asyncHandler(async (req, res) => {
    const status = req.query.status as StudyTypeStatus | undefined;
    res.json(await listStudyTypes(status));
  })
);

studyTypesRouter.get(
  "/study-types/:id",
  asyncHandler(async (req, res) => {
    res.json(await getStudyType(req.params.id));
  })
);

// Spec 3.2/43: only Administrators create/edit/archive STUDY TYPES.
studyTypesRouter.post(
  "/study-types",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(createStudyTypeSchema, req.body);
    const studyType = await createStudyType(input, req.user!.id);
    res.status(201).json(studyType);
  })
);

studyTypesRouter.patch(
  "/study-types/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(updateStudyTypeSchema, req.body);
    res.json(await updateStudyType(req.params.id, input, req.user!.id));
  })
);

studyTypesRouter.delete(
  "/study-types/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    await deleteStudyType(req.params.id, req.user!.id);
    res.status(204).send();
  })
);

studyTypesRouter.post(
  "/study-types/:id/duplicate",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    res.status(201).json(await duplicateStudyType(req.params.id, req.user!.id));
  })
);

// Spec 36: drag-and-drop task reordering within a Study Type template.
studyTypesRouter.post(
  "/study-types/:id/tasks/reorder",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(reorderStudyTypeTasksSchema, req.body);
    res.json(await reorderStudyTypeTasks(req.params.id, input.tasks, req.user!.id));
  })
);

// Spec 35: "Add TASK" on the Study Type Edit Screen.
studyTypesRouter.post(
  "/study-types/:id/tasks",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(addStudyTypeTaskSchema, req.body);
    res.status(201).json(await addStudyTypeTask(req.params.id, input, req.user!.id));
  })
);

// Spec 35: "Rename TASK" / "Edit description".
studyTypesRouter.patch(
  "/study-types/:id/tasks/:taskId",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(updateStudyTypeTaskSchema, req.body);
    res.json(await updateStudyTypeTask(req.params.id, req.params.taskId, input, req.user!.id));
  })
);

// Spec 35: "Delete TASK".
studyTypesRouter.delete(
  "/study-types/:id/tasks/:taskId",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    await deleteStudyTypeTask(req.params.id, req.params.taskId, req.user!.id);
    res.status(204).send();
  })
);
