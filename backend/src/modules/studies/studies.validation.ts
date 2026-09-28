import { Priority, StudyStatus } from "@prisma/client";
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

// A Study is defined first (status PROPOSED) with just its info fields —
// no tasks yet. Tasks only get created later, on confirmStudySoldSchema.
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
  })
  .refine((data) => data.originalCompletionDate >= data.originalStartDate, {
    message: "Original Completion Date cannot be earlier than Original Start Date.",
    path: ["originalCompletionDate"],
  });

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

// Confirming a Study as sold: instantiate the rest of its tasks from the
// chosen template (or build them from scratch), and flip PROPOSED -> CONFIRMED_SOLD.
export const confirmStudySoldSchema = z
  .object({
    taskCreationMethod: z.enum(["STUDY_TYPE_AS_IS", "MODIFIED_TEMPLATE", "FROM_SCRATCH"]),
    studyTypeId: z.string().uuid().optional(),
    tasks: z.array(inlineTaskSchema).optional(),
    version: z.number().int(),
  })
  .refine(
    (data) =>
      data.taskCreationMethod === "FROM_SCRATCH" ? !!data.tasks && data.tasks.length > 0 : true,
    { message: "At least one task is required.", path: ["tasks"] }
  );

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
