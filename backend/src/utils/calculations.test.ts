import { describe, expect, it } from "vitest";
import { Task, TaskStatus } from "@prisma/client";
import {
  currentStudyStage,
  expectedCompletionDate,
  scheduleVarianceDays,
  studyProgressPercent,
  taskStatusSummary,
} from "./calculations";

let seq = 0;
function makeTask(overrides: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `task-${seq}`,
    studyId: "study-1",
    sourceStudyTypeTaskId: null,
    taskName: `Task ${seq}`,
    description: null,
    groupName: null,
    sequenceNumber: seq,
    currentStartDate: new Date("2026-01-01"),
    currentEndDate: new Date("2026-01-02"),
    status: TaskStatus.NOT_STARTED,
    isFixed: false,
    dateChangeCount: 0,
    createdBy: "user-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    completedAt: null,
    deletedAt: null,
    deletedBy: null,
    version: 1,
    ...overrides,
  };
}

describe("taskStatusSummary", () => {
  it("counts each status, excluding NOT_APPLICABLE from the total", () => {
    const tasks = [
      makeTask({ status: TaskStatus.NOT_STARTED }),
      makeTask({ status: TaskStatus.IN_PROGRESS }),
      makeTask({ status: TaskStatus.COMPLETE }),
      makeTask({ status: TaskStatus.NOT_APPLICABLE }),
    ];
    expect(taskStatusSummary(tasks)).toEqual({
      total: 3,
      notStarted: 1,
      inProgress: 1,
      complete: 1,
      notApplicable: 1,
    });
  });

  it("returns all zeros for an empty list", () => {
    expect(taskStatusSummary([])).toEqual({
      total: 0,
      notStarted: 0,
      inProgress: 0,
      complete: 0,
      notApplicable: 0,
    });
  });
});

describe("studyProgressPercent", () => {
  it("is 0% for a Study with no tasks", () => {
    expect(studyProgressPercent([])).toBe(0);
  });

  it("is 0% when every task is Not Applicable (no applicable work)", () => {
    const tasks = [makeTask({ status: TaskStatus.NOT_APPLICABLE })];
    expect(studyProgressPercent(tasks)).toBe(0);
  });

  it("divides by applicable tasks only, excluding Not Applicable", () => {
    const tasks = [
      makeTask({ status: TaskStatus.COMPLETE }),
      makeTask({ status: TaskStatus.NOT_STARTED }),
      makeTask({ status: TaskStatus.NOT_APPLICABLE }),
    ];
    // 1 of 2 applicable tasks complete = 50%, not 1 of 3 = 33%.
    expect(studyProgressPercent(tasks)).toBe(50);
  });

  it("rounds to the nearest whole percent", () => {
    const tasks = [
      makeTask({ status: TaskStatus.COMPLETE }),
      makeTask({ status: TaskStatus.NOT_STARTED }),
      makeTask({ status: TaskStatus.NOT_STARTED }),
    ];
    expect(studyProgressPercent(tasks)).toBe(33);
  });
});

describe("currentStudyStage", () => {
  it("is 'No Tasks' for an empty list", () => {
    expect(currentStudyStage([])).toBe("No Tasks");
  });

  it("is the first non-complete task by sequence number", () => {
    const tasks = [
      makeTask({ sequenceNumber: 2, taskName: "Second", status: TaskStatus.NOT_STARTED }),
      makeTask({ sequenceNumber: 1, taskName: "First", status: TaskStatus.COMPLETE }),
      makeTask({ sequenceNumber: 3, taskName: "Third", status: TaskStatus.NOT_STARTED }),
    ];
    expect(currentStudyStage(tasks)).toBe("Second");
  });

  it("is 'Complete' once every applicable task is done", () => {
    const tasks = [
      makeTask({ status: TaskStatus.COMPLETE }),
      makeTask({ status: TaskStatus.NOT_APPLICABLE }),
    ];
    expect(currentStudyStage(tasks)).toBe("Complete");
  });
});

describe("expectedCompletionDate", () => {
  it("is null for an empty list", () => {
    expect(expectedCompletionDate([])).toBeNull();
  });

  it("is the latest end date among incomplete tasks", () => {
    const tasks = [
      makeTask({ status: TaskStatus.NOT_STARTED, currentEndDate: new Date("2026-02-01") }),
      makeTask({ status: TaskStatus.IN_PROGRESS, currentEndDate: new Date("2026-03-15") }),
      makeTask({ status: TaskStatus.COMPLETE, currentEndDate: new Date("2026-01-01") }),
    ];
    expect(expectedCompletionDate(tasks)).toEqual(new Date("2026-03-15"));
  });

  it("ignores Not Applicable tasks' dates", () => {
    const tasks = [
      makeTask({ status: TaskStatus.NOT_STARTED, currentEndDate: new Date("2026-02-01") }),
      makeTask({ status: TaskStatus.NOT_APPLICABLE, currentEndDate: new Date("2026-06-01") }),
    ];
    expect(expectedCompletionDate(tasks)).toEqual(new Date("2026-02-01"));
  });

  it("falls back to the latest completedAt once everything is done", () => {
    const tasks = [
      makeTask({ status: TaskStatus.COMPLETE, completedAt: new Date("2026-01-10") }),
      makeTask({ status: TaskStatus.COMPLETE, completedAt: new Date("2026-01-20") }),
    ];
    expect(expectedCompletionDate(tasks)).toEqual(new Date("2026-01-20"));
  });
});

describe("scheduleVarianceDays", () => {
  it("is null when either date is missing", () => {
    expect(scheduleVarianceDays(null, new Date("2026-01-01"))).toBeNull();
    expect(scheduleVarianceDays(new Date("2026-01-01"), null)).toBeNull();
  });

  it("is positive when running late", () => {
    expect(scheduleVarianceDays(new Date("2026-01-10"), new Date("2026-01-05"))).toBe(5);
  });

  it("is negative when running ahead", () => {
    expect(scheduleVarianceDays(new Date("2026-01-01"), new Date("2026-01-05"))).toBe(-4);
  });

  it("is 0 when exactly on schedule", () => {
    expect(scheduleVarianceDays(new Date("2026-01-05"), new Date("2026-01-05"))).toBe(0);
  });
});
