import { TaskStatus } from "@prisma/client";
import { z } from "zod";

const dateString = z.coerce.date();

// Spec 52: TASK — Task Name, Start Date, End Date required; End >= Start;
// Sequence must be a positive integer.
export const createTaskSchema = z
  .object({
    taskName: z.string().trim().min(1, "Task name is required."),
    description: z.string().optional(),
    startDate: dateString,
    endDate: dateString,
    sequenceNumber: z.number().int().positive().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Task End Date cannot be earlier than Task Start Date.",
    path: ["endDate"],
  });

// Spec 16-17: date edits are validated and diffed against current dates.
export const updateTaskSchema = z
  .object({
    taskName: z.string().trim().min(1).optional(),
    description: z.string().optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    version: z.number().int(),
  })
  .refine((data) => (data.startDate && data.endDate ? data.endDate >= data.startDate : true), {
    message: "Task End Date cannot be earlier than Task Start Date.",
    path: ["endDate"],
  });

export const changeTaskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  version: z.number().int(),
});

export const reorderTasksSchema = z.object({
  tasks: z
    .array(
      z.object({
        task_id: z.string().uuid(),
        sequence: z.number().int().positive(),
      })
    )
    .min(1),
});
