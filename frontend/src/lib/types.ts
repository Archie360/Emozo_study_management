// Mirrors the backend's Prisma models / API responses (see ../../../backend/prisma/schema.prisma).

export type UserRole = "STANDARD" | "ADMIN";
export type StudyStatus = "PROPOSED" | "CONFIRMED_SOLD" | "COMPLETE" | "CANCELLED";
export type StudyTypeStatus = "ACTIVE" | "ARCHIVED";
export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" | "NOT_APPLICABLE";
export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type TaskCreationMethod = "STUDY_TYPE_AS_IS" | "MODIFIED_TEMPLATE" | "FROM_SCRATCH";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface StudyType {
  id: string;
  name: string;
  description: string | null;
  status: StudyTypeStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  tasks?: StudyTypeTask[];
  _count?: { tasks: number; studies?: number };
}

export interface StudyTypeTask {
  id: string;
  studyTypeId: string;
  taskName: string;
  description: string | null;
  groupName: string | null;
  sequenceNumber: number;
  defaultDurationDays: number | null;
  isFixed: boolean;
}

export interface Task {
  id: string;
  studyId: string;
  taskName: string;
  description: string | null;
  groupName: string | null;
  sourceStudyTypeTaskId: string | null;
  sequenceNumber: number;
  currentStartDate: string;
  currentEndDate: string;
  status: TaskStatus;
  isFixed: boolean;
  dateChangeCount: number;
  completedAt: string | null;
  version: number;
  previousStartDate?: string | null;
  previousEndDate?: string | null;
}

export interface TaskDateHistoryEntry {
  id: string;
  taskId: string;
  previousStartDate: string;
  previousEndDate: string;
  newStartDate: string;
  newEndDate: string;
  versionNumber: number;
  changedAt: string;
  changer: User;
}

export interface TaskStatusHistoryEntry {
  id: string;
  taskId: string;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  changedAt: string;
  changer: User;
}

export interface StudyMetrics {
  progressPercent: number;
  currentStage: string;
  taskStatusSummary: {
    total: number;
    notStarted: number;
    inProgress: number;
    complete: number;
    notApplicable: number;
  };
  scheduleVarianceDays: number | null;
  allTasksComplete: boolean;
}

export interface Study {
  id: string;
  studyName: string;
  studyTypeId: string | null;
  studyType: StudyType | null;
  description: string | null;
  ownerUserId: string;
  owner: User;
  emozoPoc: string | null;
  clientBusinessUnit: string | null;
  clientName: string | null;
  clientLocation: string | null;
  sponsorInfo: string | null;
  priority: Priority | null;
  originalStartDate: string | null;
  previousOriginalStartDate: string | null;
  originalStartDateChangeCount: number;
  originalCompletionDate: string | null;
  previousOriginalCompletionDate: string | null;
  originalCompletionDateChangeCount: number;
  currency: string;
  likelyTotalRevenue: string | null;
  previousTotalRevenue: string | null;
  totalRevenueChangeCount: number;
  estimatedTotalExpenses: string | null;
  previousTotalExpenses: string | null;
  totalExpensesChangeCount: number;
  currentExpectedCompletionDate: string | null;
  status: StudyStatus;
  taskCreationMethod: TaskCreationMethod | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  tasks: Task[];
  metrics: StudyMetrics;
}

// Spec 45: GET /api/v1/reports/active-studies item shape.
export interface ActiveStudyReportItem {
  studyId: string;
  studyName: string;
  owner: User;
  studyType: StudyType | null;
  progressPercent: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  currentStage: string;
  createdAt: string;
  originalCompletion: string | null;
  expectedCompletion: string | null;
  scheduleVarianceDays: number | null;
}

export interface Paginated<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}
