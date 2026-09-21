import { z } from "zod";

// Spec 52: STUDY TYPE — Name required, unique among ACTIVE types (checked in service).
export const createStudyTypeSchema = z.object({
  name: z.string().trim().min(1, "Study Type name is required."),
  description: z.string().optional(),
  tasks: z
    .array(
      z.object({
        taskName: z.string().trim().min(1, "Task name is required."),
        description: z.string().optional(),
        sequenceNumber: z.number().int().positive(),
        defaultDurationDays: z.number().int().nonnegative().optional(),
      })
    )
    .default([]),
});

export const updateStudyTypeSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  version: z.number().int(),
});

export const reorderStudyTypeTasksSchema = z.object({
  tasks: z
    .array(
      z.object({
        taskId: z.string().uuid(),
        sequence: z.number().int().positive(),
      })
    )
    .min(1),
});

export const addStudyTypeTaskSchema = z.object({
  taskName: z.string().trim().min(1, "Task name is required."),
  description: z.string().optional(),
  sequenceNumber: z.number().int().positive().optional(),
  defaultDurationDays: z.number().int().nonnegative().optional(),
});

export const updateStudyTypeTaskSchema = z.object({
  taskName: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  defaultDurationDays: z.number().int().nonnegative().optional(),
});

export const createStudyTypeFromStudySchema = z.object({
  name: z.string().trim().min(1, "Study Type name is required."),
  description: z.string().optional(),
});
