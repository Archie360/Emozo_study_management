import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { parseOrThrow } from "../../utils/validate";
import {
  changeTaskStatus,
  createTask,
  deleteTask,
  getTask,
  listTasksForStudy,
  reorderTasks,
  updateTask,
} from "./tasks.service";
import {
  changeTaskStatusSchema,
  createTaskSchema,
  reorderTasksSchema,
  updateTaskSchema,
} from "./tasks.validation";
import { getTaskDateHistory, getTaskStatusHistory } from "../taskHistory/taskHistory.service";
import { addTaskComment, deleteTaskComment, listTaskComments } from "../taskComments/taskComments.service";
import { ValidationError } from "../../utils/errors";

export const tasksRouter = Router();

studyScopedRoutes();
taskScopedRoutes();

function studyScopedRoutes() {
  // Spec 41: POST /api/v1/studies/{study_id}/tasks
  tasksRouter.get(
    "/studies/:studyId/tasks",
    asyncHandler(async (req, res) => {
      res.json(await listTasksForStudy(req.params.studyId));
    })
  );

  tasksRouter.post(
    "/studies/:studyId/tasks",
    asyncHandler(async (req, res) => {
      const input = parseOrThrow(createTaskSchema, req.body);
      const task = await createTask(req.params.studyId, input, req.user!.id);
      res.status(201).json(task);
    })
  );

  // Spec 41: POST /api/v1/studies/{study_id}/tasks/reorder
  tasksRouter.post(
    "/studies/:studyId/tasks/reorder",
    asyncHandler(async (req, res) => {
      const input = parseOrThrow(reorderTasksSchema, req.body);
      const order = input.tasks.map((t) => ({ taskId: t.task_id, sequence: t.sequence }));
      res.json(await reorderTasks(req.params.studyId, order, req.user!.id));
    })
  );
}

function taskScopedRoutes() {
  tasksRouter.get(
    "/tasks/:id",
    asyncHandler(async (req, res) => {
      res.json(await getTask(req.params.id));
    })
  );

  // Spec 41: PATCH /api/v1/tasks/{task_id}
  tasksRouter.patch(
    "/tasks/:id",
    asyncHandler(async (req, res) => {
      const input = parseOrThrow(updateTaskSchema, req.body);
      res.json(await updateTask(req.params.id, input, req.user!.id));
    })
  );

  // Spec 41: POST /api/v1/tasks/{task_id}/status
  tasksRouter.post(
    "/tasks/:id/status",
    asyncHandler(async (req, res) => {
      const input = parseOrThrow(changeTaskStatusSchema, req.body);
      res.json(await changeTaskStatus(req.params.id, input, req.user!.id));
    })
  );

  // Spec 41: DELETE /api/v1/tasks/{task_id}
  tasksRouter.delete(
    "/tasks/:id",
    asyncHandler(async (req, res) => {
      await deleteTask(req.params.id, req.user!.id);
      res.status(204).send();
    })
  );

  // Spec 42: GET /api/v1/tasks/{task_id}/date-history and /status-history
  tasksRouter.get(
    "/tasks/:id/date-history",
    asyncHandler(async (req, res) => {
      res.json(await getTaskDateHistory(req.params.id));
    })
  );

  tasksRouter.get(
    "/tasks/:id/status-history",
    asyncHandler(async (req, res) => {
      res.json(await getTaskStatusHistory(req.params.id));
    })
  );

  // Notes/comments on a Task — open-ended, unlike the system-generated
  // date/status history above.
  tasksRouter.get(
    "/tasks/:id/comments",
    asyncHandler(async (req, res) => {
      res.json(await listTaskComments(req.params.id));
    })
  );

  tasksRouter.post(
    "/tasks/:id/comments",
    asyncHandler(async (req, res) => {
      const { body } = req.body as { body?: string };
      if (!body) throw new ValidationError("Comment is required.", { body: "Required" });
      const comment = await addTaskComment(req.params.id, body, req.user!.id);
      res.status(201).json(comment);
    })
  );

  tasksRouter.delete(
    "/tasks/:id/comments/:commentId",
    asyncHandler(async (req, res) => {
      await deleteTaskComment(req.params.id, req.params.commentId, req.user!.id, req.user!.role);
      res.status(204).send();
    })
  );
}
