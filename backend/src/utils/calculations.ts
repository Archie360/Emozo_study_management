import { Task, TaskStatus } from "@prisma/client";

/**
 * Study progress %, current stage, task status summary, expected completion
 * and schedule variance — spec sections 21, 23, 24, 25, 26.
 */

export interface TaskStatusSummary {
  total: number;
  notStarted: number;
  inProgress: number;
  complete: number;
  notApplicable: number;
}

// NOT_APPLICABLE tasks are excluded from progress/stage/completion math
// entirely (they're not part of the work being tracked) but still counted
// separately so the UI can show they exist.
function applicable(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status !== TaskStatus.NOT_APPLICABLE);
}

export function taskStatusSummary(tasks: Task[]): TaskStatusSummary {
  const relevant = applicable(tasks);
  return {
    total: relevant.length,
    notStarted: relevant.filter((t) => t.status === TaskStatus.NOT_STARTED).length,
    inProgress: relevant.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
    complete: relevant.filter((t) => t.status === TaskStatus.COMPLETE).length,
    notApplicable: tasks.length - relevant.length,
  };
}

// Spec 24: Progress % = Complete Tasks / Total Tasks x 100. Zero tasks => 0%.
export function studyProgressPercent(tasks: Task[]): number {
  const relevant = applicable(tasks);
  if (relevant.length === 0) return 0;
  const complete = relevant.filter((t) => t.status === TaskStatus.COMPLETE).length;
  return Math.round((complete / relevant.length) * 100);
}

// Spec 26: first non-complete task by sequence, or "Complete" if all done.
export function currentStudyStage(tasks: Task[]): string {
  const relevant = applicable(tasks);
  if (relevant.length === 0) return "No Tasks";
  const sorted = [...relevant].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const current = sorted.find((t) => t.status !== TaskStatus.COMPLETE);
  return current ? current.taskName : "Complete";
}

/**
 * Spec 21: for ACTIVE studies, expected completion is the latest current_end_date
 * among tasks not marked COMPLETE. If every task is COMPLETE, the recommended
 * approach (spec 21) is to use the final task completion date.
 */
export function expectedCompletionDate(tasks: Task[]): Date | null {
  const relevant = applicable(tasks);
  if (relevant.length === 0) return null;

  const incomplete = relevant.filter((t) => t.status !== TaskStatus.COMPLETE);
  if (incomplete.length > 0) {
    return incomplete.reduce(
      (latest, t) => (t.currentEndDate > latest ? t.currentEndDate : latest),
      incomplete[0].currentEndDate
    );
  }

  const completions = relevant
    .map((t) => t.completedAt)
    .filter((d): d is Date => d !== null);
  if (completions.length > 0) {
    return completions.reduce((latest, d) => (d > latest ? d : latest), completions[0]);
  }

  // Fallback: no completedAt recorded, use latest current end date.
  return relevant.reduce(
    (latest, t) => (t.currentEndDate > latest ? t.currentEndDate : latest),
    relevant[0].currentEndDate
  );
}

// Spec 23: schedule_variance_days = current_expected_completion_date - original_completion_date
export function scheduleVarianceDays(
  currentExpectedCompletionDate: Date | null,
  originalCompletionDate: Date | null
): number | null {
  if (!currentExpectedCompletionDate || !originalCompletionDate) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (currentExpectedCompletionDate.getTime() - originalCompletionDate.getTime()) / msPerDay
  );
}
