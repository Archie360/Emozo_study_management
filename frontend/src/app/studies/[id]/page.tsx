"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Study, StudyStatus, Task, TaskStatus } from "@/lib/types";
import { formatDate, formatScheduleVariance, toInputDate } from "@/lib/format";
import { StudyStatusBadge, TaskStatusBadge, PriorityBadge } from "@/components/Badge";
import { Button, Card, ErrorBanner, Field, inputClass, Modal, ProgressBar, SuccessToast } from "@/components/ui";

const STUDY_STATUS_OPTIONS: Record<StudyStatus, StudyStatus[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["COMPLETE", "CANCELLED"],
  COMPLETE: ["ACTIVE"],
  CANCELLED: ["DRAFT", "ACTIVE"],
};

// Spec 18: valid TASK status transitions (including permitted backwards ones).
const TASK_STATUS_OPTIONS: Record<TaskStatus, TaskStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS", "COMPLETE"],
  IN_PROGRESS: ["COMPLETE", "NOT_STARTED"],
  COMPLETE: ["IN_PROGRESS"],
};

type ModalState =
  | { type: "none" }
  | { type: "editStudy" }
  | { type: "changeStudyStatus" }
  | { type: "addTask" }
  | { type: "saveAsType" }
  | { type: "editTask"; task: Task }
  | { type: "changeTaskStatus"; task: Task }
  | { type: "deleteTask"; task: Task };

export default function StudyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: study, loading, error, reload } = useApi<Study>(() => api.get(`/studies/${id}`), [id]);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [toast, setToast] = useState<string | null>(null);

  function closeAndReload(message?: string) {
    setModal({ type: "none" });
    reload();
    if (message) {
      setToast(message);
      setTimeout(() => setToast(null), 3000);
    }
  }

  if (loading) return <AuthGate><p className="text-sm text-gray-500">Loading…</p></AuthGate>;
  if (error || !study) return <AuthGate><ErrorBanner message={error ?? "Study not found."} /></AuthGate>;

  return (
    <AuthGate>
      <SuccessToast message={toast} />

      {/* Study Header — spec 31 */}
      <Card className="mb-6 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">{study.studyName}</h1>
              <StudyStatusBadge status={study.status} />
              <PriorityBadge priority={study.priority} />
            </div>
            <p className="text-sm text-gray-500">
              {study.studyType?.name ?? "Custom"} · Owner: {study.owner.name}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setModal({ type: "editStudy" })}>
              Edit Study
            </Button>
            <Button variant="secondary" onClick={() => setModal({ type: "changeStudyStatus" })}>
              Change Status
            </Button>
            <Button variant="secondary" onClick={() => setModal({ type: "addTask" })}>
              Add Task
            </Button>
            <Button variant="secondary" onClick={() => setModal({ type: "saveAsType" })}>
              Save as Study Type
            </Button>
          </div>
        </div>

        {study.metrics.allTasksComplete && study.status === "ACTIVE" && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            All tasks are complete.{" "}
            <button
              className="font-medium underline"
              onClick={() => setModal({ type: "changeStudyStatus" })}
            >
              Mark this Study as Complete?
            </button>
          </div>
        )}

        {/* Study Summary — spec 31 */}
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-4">
          <SummaryItem label="Original Start" value={formatDate(study.originalStartDate)} />
          <SummaryItem label="Original Completion" value={formatDate(study.originalCompletionDate)} />
          <SummaryItem label="Current Expected Completion" value={formatDate(study.currentExpectedCompletionDate)} />
          <SummaryItem label="Schedule Variance" value={formatScheduleVariance(study.metrics.scheduleVarianceDays)} />
          <div>
            <dt className="text-xs font-medium uppercase text-gray-400">Progress</dt>
            <dd className="mt-1">
              <ProgressBar percent={study.metrics.progressPercent} />
            </dd>
          </div>
          <SummaryItem
            label="Task Count"
            value={`${study.metrics.taskStatusSummary.total} (${study.metrics.taskStatusSummary.complete} complete)`}
          />
          <SummaryItem label="Current Stage" value={study.metrics.currentStage} />
        </dl>
      </Card>

      {/* Task Table — spec 31 */}
      <Card className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Seq</th>
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Current Start</th>
              <th className="px-4 py-3">Current End</th>
              <th className="px-4 py-3">Previous Start</th>
              <th className="px-4 py-3">Previous End</th>
              <th className="px-4 py-3">Changes</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {study.tasks.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                  No tasks yet.
                </td>
              </tr>
            )}
            {study.tasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{task.sequenceNumber}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link href={`/tasks/${task.id}`} className="hover:underline">
                    {task.taskName}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <TaskStatusBadge status={task.status} />
                </td>
                <td className="px-4 py-3 text-gray-600">{formatDate(task.currentStartDate)}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(task.currentEndDate)}</td>
                <td className="px-4 py-3 text-gray-400">{formatDate(task.previousStartDate)}</td>
                <td className="px-4 py-3 text-gray-400">{formatDate(task.previousEndDate)}</td>
                <td className="px-4 py-3 text-gray-500">{task.dateChangeCount}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="text-xs text-gray-600 hover:underline" onClick={() => setModal({ type: "editTask", task })}>
                      Edit
                    </button>
                    <button
                      className="text-xs text-gray-600 hover:underline"
                      onClick={() => setModal({ type: "changeTaskStatus", task })}
                    >
                      Status
                    </button>
                    <Link href={`/tasks/${task.id}`} className="text-xs text-gray-600 hover:underline">
                      History
                    </Link>
                    <button
                      className="text-xs text-red-500 hover:underline"
                      onClick={() => setModal({ type: "deleteTask", task })}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {modal.type === "editStudy" && (
        <EditStudyModal study={study} onClose={() => setModal({ type: "none" })} onSaved={closeAndReload} />
      )}
      {modal.type === "changeStudyStatus" && (
        <ChangeStudyStatusModal study={study} onClose={() => setModal({ type: "none" })} onSaved={closeAndReload} />
      )}
      {modal.type === "addTask" && (
        <AddTaskModal studyId={study.id} onClose={() => setModal({ type: "none" })} onSaved={closeAndReload} />
      )}
      {modal.type === "saveAsType" && (
        <SaveAsTypeModal
          studyId={study.id}
          onClose={() => setModal({ type: "none" })}
          onSaved={(newTypeId) => {
            setModal({ type: "none" });
            setToast("Study Type created.");
            router.push(`/study-types/${newTypeId}`);
          }}
        />
      )}
      {modal.type === "editTask" && (
        <EditTaskModal task={modal.task} onClose={() => setModal({ type: "none" })} onSaved={closeAndReload} />
      )}
      {modal.type === "changeTaskStatus" && (
        <ChangeTaskStatusModal task={modal.task} onClose={() => setModal({ type: "none" })} onSaved={closeAndReload} />
      )}
      {modal.type === "deleteTask" && (
        <DeleteTaskModal task={modal.task} onClose={() => setModal({ type: "none" })} onSaved={closeAndReload} />
      )}
    </AuthGate>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

// --- Modals -----------------------------------------------------------

function EditStudyModal({ study, onClose, onSaved }: { study: Study; onClose: () => void; onSaved: (msg: string) => void }) {
  const [studyName, setStudyName] = useState(study.studyName);
  const [description, setDescription] = useState(study.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/studies/${study.id}`, { studyName, description, version: study.version });
      onSaved("Study updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="Edit Study" onClose={onClose}>
      <ErrorBanner message={error} />
      <div className="space-y-4">
        <Field label="Study Name">
          <input className={inputClass} value={studyName} onChange={(e) => setStudyName(e.target.value)} />
        </Field>
        <Field label="Description">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <p className="text-xs text-gray-400">
          Original Start/Completion dates are locked once a Study leaves Draft (spec 22) — contact an
          Administrator to rebaseline.
        </p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function ChangeStudyStatusModal({ study, onClose, onSaved }: { study: Study; onClose: () => void; onSaved: (msg: string) => void }) {
  const options = STUDY_STATUS_OPTIONS[study.status];
  const [status, setStatus] = useState<StudyStatus>(options[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/studies/${study.id}/status`, { status, version: study.version });
      onSaved("Study status changed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change status.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="Change Study Status" onClose={onClose}>
      <ErrorBanner message={error} />
      <Field label={`Current status: ${study.status}`}>
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as StudyStatus)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </Field>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={submitting}>
          {submitting ? "Saving…" : "Confirm"}
        </Button>
      </div>
    </Modal>
  );
}

function AddTaskModal({ studyId, onClose, onSaved }: { studyId: string; onClose: () => void; onSaved: (msg: string) => void }) {
  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.post(`/studies/${studyId}/tasks`, { taskName, description: description || undefined, startDate, endDate });
      onSaved("Task added.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError("Failed to add task.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="Add Task" onClose={onClose}>
      <ErrorBanner message={error} />
      <div className="space-y-4">
        <Field label="Task Name *" error={fieldErrors.taskName}>
          <input className={inputClass} value={taskName} onChange={(e) => setTaskName(e.target.value)} />
        </Field>
        <Field label="Description">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Date *">
            <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End Date *" error={fieldErrors.endDate}>
            <input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={submitting || !taskName || !startDate || !endDate}>
          {submitting ? "Adding…" : "Add Task"}
        </Button>
      </div>
    </Modal>
  );
}

function SaveAsTypeModal({
  studyId,
  onClose,
  onSaved,
}: {
  studyId: string;
  onClose: () => void;
  onSaved: (newTypeId: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      const type = await api.post<{ id: string }>(`/studies/${studyId}/create-study-type`, {
        name,
        description: description || undefined,
      });
      onSaved(type.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="Save Task Structure as Study Type" onClose={onClose}>
      <ErrorBanner message={error} />
      <p className="mb-4 text-xs text-gray-500">
        Spec 44: only task name, description and sequence are copied — no dates, status or history.
      </p>
      <div className="space-y-4">
        <Field label="New Study Type Name *">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={submitting || !name}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function EditTaskModal({ task, onClose, onSaved }: { task: Task; onClose: () => void; onSaved: (msg: string) => void }) {
  const [taskName, setTaskName] = useState(task.taskName);
  const [startDate, setStartDate] = useState(toInputDate(task.currentStartDate));
  const [endDate, setEndDate] = useState(toInputDate(task.currentEndDate));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.patch(`/tasks/${task.id}`, { taskName, startDate, endDate, version: task.version });
      onSaved("Task dates changed.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError("Failed to save.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="Edit Task" onClose={onClose}>
      <ErrorBanner message={error} />
      <div className="space-y-4">
        <Field label="Task Name">
          <input className={inputClass} value={taskName} onChange={(e) => setTaskName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Date">
            <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End Date" error={fieldErrors.endDate}>
            <input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-gray-400">
          Spec 8: changing both dates in one save counts as a single date-change event.
        </p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function ChangeTaskStatusModal({ task, onClose, onSaved }: { task: Task; onClose: () => void; onSaved: (msg: string) => void }) {
  const options = TASK_STATUS_OPTIONS[task.status];
  const [status, setStatus] = useState<TaskStatus>(options[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/tasks/${task.id}/status`, { status, version: task.version });
      onSaved("Task status changed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change status.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="Change Task Status" onClose={onClose}>
      <ErrorBanner message={error} />
      <Field label={`Current status: ${task.status}`}>
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </Field>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={submitting}>
          {submitting ? "Saving…" : "Confirm"}
        </Button>
      </div>
    </Modal>
  );
}

function DeleteTaskModal({ task, onClose, onSaved }: { task: Task; onClose: () => void; onSaved: (msg: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      await api.delete(`/tasks/${task.id}`);
      onSaved("Task deleted.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="Delete Task" onClose={onClose}>
      <ErrorBanner message={error} />
      <p className="text-sm text-gray-600">
        Delete <strong>{task.taskName}</strong>? This removes it from the active task list; its history
        remains available for audit (spec 37-38).
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={confirm} disabled={submitting}>
          {submitting ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}
