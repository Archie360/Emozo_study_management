import { Priority, StudyStatus } from "@prisma/client";
import { z } from "zod";

const dateString = z.coerce.date();

const inlineTaskSchema = z.object({
  taskName: z.string().trim().min(1, "Task name is required."),
  description: z.string().optional(),
  startDate: dateString,
  endDate: dateString,
  sequenceNumber: z.number().int().positive(),
});

// Spec 11: Stage 1 minimum required fields, plus the task-creation method
// the user picked ("How would you like to create the Study Tasks?").
export const createStudySchema = z
  .object({
    studyName: z.string().trim().min(1, "Study Name is required."),
    ownerUserId: z.string().uuid("Owner is required."),
    description: z.string().optional(),
    clientBusinessUnit: z.string().optional(),
    priority: z.nativeEnum(Priority).optional(),
    status: z.nativeEnum(StudyStatus).default(StudyStatus.DRAFT),
    originalStartDate: dateString,
    originalCompletionDate: dateString,
    taskCreationMethod: z.enum(["STUDY_TYPE_AS_IS", "MODIFIED_TEMPLATE", "FROM_SCRATCH"]),
    studyTypeId: z.string().uuid().optional(),
    // Required for MODIFIED_TEMPLATE / FROM_SCRATCH; ignored for STUDY_TYPE_AS_IS,
    // whose tasks are copied server-side from the referenced Study Type (spec 12).
    tasks: z.array(inlineTaskSchema).optional(),
  })
  .refine((data) => data.originalCompletionDate >= data.originalStartDate, {
    message: "Original Completion Date cannot be earlier than Original Start Date.",
    path: ["originalCompletionDate"],
  })
  .refine((data) => data.taskCreationMethod === "STUDY_TYPE_AS_IS" ? !!data.studyTypeId : true, {
    message: "A Study Type must be selected for this task creation method.",
    path: ["studyTypeId"],
  })
  .refine(
    (data) =>
      data.taskCreationMethod === "FROM_SCRATCH" ? !!data.tasks && data.tasks.length > 0 : true,
    { message: "At least one task is required.", path: ["tasks"] }
  );

export const updateStudySchema = z.object({
  studyName: z.string().trim().min(1).optional(),
  ownerUserId: z.string().uuid().optional(),
  description: z.string().optional(),
  clientBusinessUnit: z.string().optional(),
  priority: z.nativeEnum(Priority).optional(),
  version: z.number().int(),
});

export const changeStudyStatusSchema = z.object({
  status: z.nativeEnum(StudyStatus),
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
