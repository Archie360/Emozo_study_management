import { Priority, StudyStatus, TaskCreationMethod } from "@prisma/client";
import { z } from "zod";

const dateString = z.coerce.date();

const inlineTaskSchema = z.object({
  taskName: z.string().trim().min(1, "Task name is required."),
  description: z.string().optional(),
  groupName: z.string().optional(),
  startDate: dateString,
  endDate: dateString,
  sequenceNumber: z.number().int().positive(),
  isFixed: z.boolean().optional(),
});

// A Study is defined first (status PROPOSED). The task-creation method is
// chosen here, once: STUDY_TYPE_AS_IS instantiates the template's first
// task group now and defers the rest to confirmStudySold (no further
// choice needed there); MODIFIED_TEMPLATE/FROM_SCRATCH create every given
// task now, since there's no template "rest" left to defer.
export const createStudySchema = z
  .object({
    studyName: z.string().trim().min(1, "Study Name is required."),
    studyTypeId: z.string().uuid("Project Type is required."),
    ownerUserId: z.string().uuid("Owner is required."),
    emozoPoc: z.string().optional(),
    description: z.string().optional(),
    clientName: z.string().optional(),
    clientLocation: z.string().optional(),
    sponsorInfo: z.string().optional(),
    clientBusinessUnit: z.string().optional(),
    priority: z.nativeEnum(Priority).optional(),
    originalStartDate: dateString,
    originalCompletionDate: dateString,
    likelyTotalRevenue: z.number().nonnegative().optional(),
    estimatedTotalExpenses: z.number().nonnegative().optional(),
    taskCreationMethod: z.nativeEnum(TaskCreationMethod),
    tasks: z.array(inlineTaskSchema).optional(),
  })
  .refine((data) => data.originalCompletionDate >= data.originalStartDate, {
    message: "Original Completion Date cannot be earlier than Original Start Date.",
    path: ["originalCompletionDate"],
  })
  .refine(
    (data) =>
      data.taskCreationMethod === TaskCreationMethod.FROM_SCRATCH
        ? !!data.tasks && data.tasks.length > 0
        : true,
    { message: "At least one task is required.", path: ["tasks"] }
  )
  .refine(
    (data) =>
      data.taskCreationMethod === TaskCreationMethod.MODIFIED_TEMPLATE
        ? !!data.tasks && data.tasks.length > 0
        : true,
    { message: "At least one task is required.", path: ["tasks"] }
  );

export const updateStudySchema = z.object({
  studyName: z.string().trim().min(1).optional(),
  ownerUserId: z.string().uuid().optional(),
  emozoPoc: z.string().optional(),
  description: z.string().optional(),
  clientName: z.string().optional(),
  clientLocation: z.string().optional(),
  sponsorInfo: z.string().optional(),
  clientBusinessUnit: z.string().optional(),
  priority: z.nativeEnum(Priority).optional(),
  version: z.number().int(),
});

export const changeStudyStatusSchema = z.object({
  status: z.nativeEnum(StudyStatus),
  version: z.number().int(),
});

// Confirming a Study as sold: the task-creation method was already fixed at
// creation, so this needs no other input — it just instantiates whatever's
// left (if anything) and flips PROPOSED -> CONFIRMED_SOLD.
export const confirmStudySoldSchema = z.object({
  version: z.number().int(),
});

export const updateStudyEstimatesSchema = z.object({
  likelyTotalRevenue: z.number().nonnegative().optional(),
  estimatedTotalExpenses: z.number().nonnegative().optional(),
  version: z.number().int(),
});

export const createStudyTypeFromStudySchema = z.object({
  name: z.string().trim().min(1, "Study Type name is required."),
  description: z.string().optional(),
});

export const studyListQuerySchema = z.object({
  status: z.nativeEnum(StudyStatus).optional(),
  owner_id: z.string().uuid().optional(),
  study_type_id: z.string().uuid().optional(),
  priority: z.nativeEnum(Priority).optional(),
  completion_from: dateString.optional(),
  completion_to: dateString.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(200).default(25),
  sort: z.string().optional(),
});
