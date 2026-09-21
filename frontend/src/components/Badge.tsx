import { StudyStatus, TaskStatus, Priority } from "@/lib/types";

// Spec 59: status is never communicated through colour alone — every badge
// carries its own text label, colour is a secondary cue only.
const STUDY_STATUS_STYLES: Record<StudyStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 ring-gray-300",
  ACTIVE: "bg-blue-50 text-blue-700 ring-blue-300",
  COMPLETE: "bg-green-50 text-green-700 ring-green-300",
  CANCELLED: "bg-red-50 text-red-700 ring-red-300",
};

const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-700 ring-gray-300",
  IN_PROGRESS: "bg-amber-50 text-amber-700 ring-amber-300",
  COMPLETE: "bg-green-50 text-green-700 ring-green-300",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: "bg-gray-100 text-gray-600 ring-gray-300",
  MEDIUM: "bg-amber-50 text-amber-700 ring-amber-300",
  HIGH: "bg-red-50 text-red-700 ring-red-300",
};

function Base({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label.replaceAll("_", " ")}
    </span>
  );
}

export function StudyStatusBadge({ status }: { status: StudyStatus }) {
  return <Base label={status} className={STUDY_STATUS_STYLES[status]} />;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Base label={status} className={TASK_STATUS_STYLES[status]} />;
}

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return <span className="text-xs text-gray-400">—</span>;
  return <Base label={priority} className={PRIORITY_STYLES[priority]} />;
}
