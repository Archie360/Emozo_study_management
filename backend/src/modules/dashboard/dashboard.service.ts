import { Priority, StudyStatus } from "@prisma/client";
import { listStudies, StudyListFilters } from "../studies/studies.service";

// Spec 45: GET /api/v1/reports/active-studies — shape matches the fields
// the spec lists explicitly for the reporting endpoint.
export async function getActiveStudiesReport(filters: Omit<StudyListFilters, "status">) {
  const { items, total, page, pageSize } = await listStudies({ ...filters, status: StudyStatus.ACTIVE });

  return {
    total,
    page,
    pageSize,
    items: items.map((study) => ({
      studyId: study.id,
      studyName: study.studyName,
      owner: study.owner,
      studyType: study.studyType,
      progressPercent: study.metrics.progressPercent,
      totalTasks: study.metrics.taskStatusSummary.total,
      completedTasks: study.metrics.taskStatusSummary.complete,
      inProgressTasks: study.metrics.taskStatusSummary.inProgress,
      notStartedTasks: study.metrics.taskStatusSummary.notStarted,
      currentStage: study.metrics.currentStage,
      originalCompletion: study.originalCompletionDate,
      expectedCompletion: study.currentExpectedCompletionDate,
      scheduleVarianceDays: study.metrics.scheduleVarianceDays,
    })),
  };
}

export interface DashboardFilters {
  ownerId?: string;
  studyTypeId?: string;
  priority?: Priority;
  completionFrom?: Date;
  completionTo?: Date;
  page: number;
  pageSize: number;
  sort?: string;
}
