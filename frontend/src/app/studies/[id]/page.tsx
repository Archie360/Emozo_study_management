"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Study, StudyStatus, StudyType, Task, TaskCreationMethod, TaskStatus } from "@/lib/types";
import { formatCurrency, formatDate, formatScheduleVariance, toInputDate } from "@/lib/format";
import { StudyStatusBadge, TaskStatusBadge, PriorityBadge } from "@/components/Badge";
import { Button, Card, ErrorBanner, Field, inputClass, Modal, ProgressBar, SuccessToast } from "@/components/ui";
import { EditableTask, StudyTaskEditor } from "@/components/StudyTaskEditor";

// PROPOSED -> CONFIRMED_SOLD only happens through the "Confirm as Sold" flow
// below (it needs a task-creation method), so it's absent here.
const STUDY_STATUS_OPTIONS: Record<StudyStatus, StudyStatus[]> = {
  PROPOSED: ["CANCELLED"],
  CONFIRMED_SOLD: ["COMPLETE", "CANCELLED"],
  COMPLETE: ["CONFIRMED_SOLD"],
  CANCELLED: ["PROPOSED", "CONFIRMED_SOLD"],
};

// Spec 18: valid TASK status transitions (including permitted backwards ones).
const TASK_STATUS_OPTIONS: Record<TaskStatus, TaskStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS", "COMPLETE", "NOT_APPLICABLE"],
  IN_PROGRESS: ["COMPLETE", "NOT_STARTED", "NOT_APPLICABLE"],
  COMPLETE: ["IN_PROGRESS"],
  NOT_APPLICABLE: ["NOT_STARTED"],
};

type ModalState =
  | { type: "none" }
  | { type: "editStudy" }
  | { type: "changeStudyStatus" }
  | { type: "confirmSold" }
  | { type: "editEstimates" }
  | { type: "addTask" }
  | { type: "saveAsType" }
  | { type: "editTask"; task: Task }
  | { type: "changeTaskStatus"; task: Task }
  | { type: "deleteTask"; task: Task }
  | { type: "markSelectedNotApplicable" };

export default function StudyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: study, loading, error, reload } = useApi<Study>(() => api.get(`/studies/${id}`), [id]);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [toast, setToast] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  function closeAndReload(message?: string) {
    setModal({ type: "none" });
    setSelectedTaskIds(new Set());
    reload();
    if (message) {
      setToast(message);
      setTimeout(() => setToast(null), 3000);
    }
  }

  function toggleTaskSelected(taskId: string) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
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
              {study.emozoPoc && ` · Emozo PoC: ${study.emozoPoc}`}
            </p>
          </div>
          <div className="flex gap-2">
            {study.status === "PROPOSED" && (
              <Button onClick={() => setModal({ type: "confirmSold" })}>Confirm as Sold</Button>
            )}
            <Button variant="secondary" onClick={() => setModal({ type: "editStudy" })}>
              Edit Study
            </Button>
            <Button variant="secondary" onClick={() => setModal({ type: "editEstimates" })}>
              Edit Estimates
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

        {study.metrics.allTasksComplete && study.status === "CONFIRMED_SOLD" && (
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
          <SummaryItem label="Client" value={study.clientName ?? "—"} />
          <SummaryItem label="Client Location" value={study.clientLocation ?? "—"} />
          <SummaryItem label="Sponsor" value={study.sponsorInfo ?? "—"} />
          <SummaryItem
            label="Likely Total Revenue"
            value={formatCurrency(study.likelyTotalRevenue)}
            subValue={
              study.totalRevenueChangeCount > 0
                ? `Previously ${formatCurrency(study.previousTotalRevenue)} · changed ${study.totalRevenueChangeCount}x`
                : undefined
            }
          />
          <SummaryItem
            label="Estimated Total Expenses"
            value={formatCurrency(study.estimatedTotalExpenses)}
            subValue={
              study.totalExpensesChangeCount > 0
                ? `Previously ${formatCurrency(study.previousTotalExpenses)} · changed ${study.totalExpensesChangeCount}x`
                : undefined
            }
          />
          <SummaryItem
            label="Original Start"
            value={formatDate(study.originalStartDate)}
            subValue={
              study.originalStartDateChangeCount > 0
                ? `Previously ${formatDate(study.previousOriginalStartDate)} · changed ${study.originalStartDateChangeCount}x`
                : undefined
            }
          />
          <SummaryItem
            label="Original Completion"
            value={formatDate(study.originalCompletionDate)}
            subValue={
              study.originalCompletionDateChangeCount > 0
                ? `Previously ${formatDate(study.previousOriginalCompletionDate)} · changed ${study.originalCompletionDateChangeCount}x`
                : undefined
            }
          />
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
            value={`${study.metrics.taskStatusSummary.total} (${study.metrics.taskStatusSummary.complete} complete, ${study.metrics.taskStatusSummary.notApplicable} N/A)`}
          />
          <SummaryItem label="Current Stage" value={study.metrics.currentStage} />
        </dl>
      </Card>

      {/* Task Table — spec 31 */}
      {selectedTaskIds.size > 0 && (
        <div className="mb-2 flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-2 text-sm">
          <span className="text-gray-600">{selectedTaskIds.size} task(s) selected</span>
          <div className="flex gap-2">
            <button className="text-gray-500 hover:underline" onClick={() => setSelectedTaskIds(new Set())}>
              Clear
            </button>
            <button
              className="font-medium text-gray-900 hover:underline"
              onClick={() => setModal({ type: "markSelectedNotApplicable" })}
            >
              Mark Not Applicable
            </button>
          </div>
        </div>
      )}
      <Card className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3"></th>
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
                <td colSpan={10} className="px-4 py-6 text-center text-gray-400">
                  No tasks yet.
                </td>
              </tr>
            )}
            {study.tasks.map((task, i) => (
              <Fragment key={task.id}>
                {task.groupName && task.groupName !== study.tasks[i - 1]?.groupName && (
                  <tr>
                    <td colSpan={10} className="bg-gray-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {task.groupName}
                    </td>
                  </tr>
                )}
                <tr className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {!task.isFixed && task.status !== "NOT_APPLICABLE" && (
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.has(task.id)}
                      onChange={() => toggleTaskSelected(task.id)}
                    />
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{task.sequenceNumber}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link href={`/tasks/${task.id}`} className="hover:underline">
                    {task.taskName}
                  </Link>
                  {task.isFixed && <span className="ml-2 text-xs font-normal text-gray-400">Fixed</span>}
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
              </Fragment>
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
      {modal.type === "confirmSold" && (
        <ConfirmSoldModal study={study} onClose={() => setModal({ type: "none" })} onSaved={closeAndReload} />
      )}
      {modal.type === "editEstimates" && (
        <EditEstimatesModal study={study} onClose={() => setModal({ type: "none" })} onSaved={closeAndReload} />
      )}
      {modal.type === "markSelectedNotApplicable" && (
        <MarkNotApplicableModal
          tasks={study.tasks.filter((t) => selectedTaskIds.has(t.id))}
          onClose={() => setModal({ type: "none" })}
          onSaved={closeAndReload}
        />
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

function SummaryItem({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
      {subValue && <dd className="text-xs text-gray-400">{subValue}</dd>}
    </div>
  );
}

// --- Modals -----------------------------------------------------------

function EditStudyModal({ study, onClose, onSaved }: { study: Study; onClose: () => void; onSaved: (msg: string) => void }) {
  const [studyName, setStudyName] = useState(study.studyName);
  const [description, setDescription] = useState(study.description ?? "");
  const [emozoPoc, setEmozoPoc] = useState(study.emozoPoc ?? "");
  const [clientName, setClientName] = useState(study.clientName ?? "");
  const [clientLocation, setClientLocation] = useState(study.clientLocation ?? "");
  const [sponsorInfo, setSponsorInfo] = useState(study.sponsorInfo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/studies/${study.id}`, {
        studyName,
        description,
        emozoPoc: emozoPoc || undefined,
        clientName: clientName || undefined,
        clientLocation: clientLocation || undefined,
        sponsorInfo: sponsorInfo || undefined,
        version: study.version,
      });
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
        <Field label="Emozo PoC">
          <input className={inputClass} value={emozoPoc} onChange={(e) => setEmozoPoc(e.target.value)} />
        </Field>
        <Field label="Client Name">
          <input className={inputClass} value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </Field>
        <Field label="Client Location">
          <input className={inputClass} value={clientLocation} onChange={(e) => setClientLocation(e.target.value)} />
        </Field>
        <Field label="Sponsor Info">
          <input className={inputClass} value={sponsorInfo} onChange={(e) => setSponsorInfo(e.target.value)} />
        </Field>
        <p className="text-xs text-gray-400">
          Original Start/Completion dates are locked once a Study leaves Proposed (spec 22) — contact an
          Administrator to rebaseline. Revenue/expenses have their own "Edit Estimates" action.
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

function EditEstimatesModal({ study, onClose, onSaved }: { study: Study; onClose: () => void; onSaved: (msg: string) => void }) {
  const [likelyTotalRevenue, setLikelyTotalRevenue] = useState(study.likelyTotalRevenue ?? "");
  const [estimatedTotalExpenses, setEstimatedTotalExpenses] = useState(study.estimatedTotalExpenses ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/studies/${study.id}/estimates`, {
        likelyTotalRevenue: likelyTotalRevenue === "" ? undefined : Number(likelyTotalRevenue),
        estimatedTotalExpenses: estimatedTotalExpenses === "" ? undefined : Number(estimatedTotalExpenses),
        version: study.version,
      });
      onSaved("Estimates updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="Edit Estimates" onClose={onClose}>
      <ErrorBanner message={error} />
      <div className="space-y-4">
        <Field label="Likely Total Revenue">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={likelyTotalRevenue}
            onChange={(e) => setLikelyTotalRevenue(e.target.value)}
          />
        </Field>
        <Field label="Estimated Total Expenses">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={estimatedTotalExpenses}
            onChange={(e) => setEstimatedTotalExpenses(e.target.value)}
          />
        </Field>
        <p className="text-xs text-gray-400">
          Changing either value keeps the previous value and a running change count.
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

// PROPOSED -> CONFIRMED_SOLD: pick how to build the rest of the Study's
// tasks, same three options the old "Create Study" step 2 offered.
function ConfirmSoldModal({ study, onClose, onSaved }: { study: Study; onClose: () => void; onSaved: (msg: string) => void }) {
  const [method, setMethod] = useState<TaskCreationMethod>("STUDY_TYPE_AS_IS");
  const [studyTypeId, setStudyTypeId] = useState(study.studyTypeId ?? "");
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: studyTypes } = useApi<StudyType[]>(() => api.get("/study-types?status=ACTIVE"), []);
  const { data: selectedStudyType } = useApi<StudyType | null>(
    () => (studyTypeId ? api.get(`/study-types/${studyTypeId}`) : Promise.resolve(null)),
    [studyTypeId]
  );

  // Group 1 (the pre-sale phase) was already instantiated when this Study
  // was created — this flow only builds what's left. Excluded by template
  // task id rather than group name so it stays correct even if the Study's
  // existing tasks were edited or renamed after creation.
  const alreadyInstantiatedIds = new Set(
    study.tasks.map((t) => t.sourceStudyTypeTaskId).filter((v): v is string => v !== null)
  );
  const remainingTemplateTasks = (type: StudyType) =>
    [...(type.tasks ?? [])]
      .filter((t) => !alreadyInstantiatedIds.has(t.id))
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const nextStartDate = (() => {
    if (study.tasks.length === 0) return study.originalStartDate ? new Date(study.originalStartDate) : new Date();
    const latestEnd = study.tasks.reduce(
      (latest, t) => (t.currentEndDate > latest ? t.currentEndDate : latest),
      study.tasks[0].currentEndDate
    );
    const next = new Date(latestEnd);
    next.setDate(next.getDate() + 1);
    return next;
  })();

  function selectStudyTypeForModify(type: StudyType) {
    setStudyTypeId(type.id);
    const remaining = remainingTemplateTasks(type);
    if (remaining.length === 0) {
      setTasks([]);
      return;
    }
    let cursor = new Date(nextStartDate);
    const seeded = remaining
      .map((t) => {
        const duration = t.defaultDurationDays ?? 1;
        const start = new Date(cursor);
        const end = new Date(cursor);
        end.setDate(end.getDate() + Math.max(duration - 1, 0));
        cursor = new Date(end);
        cursor.setDate(cursor.getDate() + 1);
        return {
          tempId: crypto.randomUUID(),
          taskName: t.taskName,
          description: t.description ?? "",
          groupName: t.groupName ?? "",
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
        };
      });
    setTasks(seeded);
  }

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/studies/${study.id}/confirm-sold`, {
        taskCreationMethod: method,
        studyTypeId: method === "FROM_SCRATCH" ? undefined : studyTypeId,
        tasks:
          method === "STUDY_TYPE_AS_IS"
            ? undefined
            : tasks.map((t, i) => ({
                taskName: t.taskName,
                description: t.description || undefined,
                groupName: t.groupName || undefined,
                startDate: t.startDate,
                endDate: t.endDate,
                sequenceNumber: i + 1,
              })),
        version: study.version,
      });
      onSaved("Study confirmed as sold — tasks created.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to confirm as sold.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    method === "STUDY_TYPE_AS_IS"
      ? !!studyTypeId
      : tasks.length > 0 && tasks.every((t) => t.taskName && t.startDate && t.endDate);

  return (
    <Modal open title="Confirm Study as Sold" onClose={onClose}>
      <ErrorBanner message={error} />
      <p className="mb-4 text-xs text-gray-500">
        {study.tasks.length > 0
          ? `The first ${study.tasks.length} task(s) were already created when this Study was defined. This instantiates the rest and moves it to CONFIRMED_SOLD.`
          : "This instantiates the Study's tasks and moves it to CONFIRMED_SOLD."}{" "}
        It cannot be undone from here.
      </p>
      <div className="space-y-2">
        {(
          [
            ["STUDY_TYPE_AS_IS", "Use an existing Study Type without modification"],
            ["MODIFIED_TEMPLATE", "Start with an existing Study Type and modify it"],
            ["FROM_SCRATCH", "Build Tasks from scratch"],
          ] as [TaskCreationMethod, string][]
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="confirm-method"
              checked={method === value}
              onChange={() => {
                setMethod(value);
                setStudyTypeId(value === "FROM_SCRATCH" ? "" : study.studyTypeId ?? "");
                setTasks([]);
              }}
            />
            {label}
          </label>
        ))}
      </div>

      {(method === "STUDY_TYPE_AS_IS" || method === "MODIFIED_TEMPLATE") && (
        <div className="mt-4">
          <Field label="Study Type *">
            <select
              className={inputClass}
              value={studyTypeId}
              onChange={(e) => {
                const type = studyTypes?.find((t) => t.id === e.target.value);
                if (!type) return;
                if (method === "MODIFIED_TEMPLATE") selectStudyTypeForModify(type);
                else setStudyTypeId(type.id);
              }}
            >
              <option value="">Select Study Type…</option>
              {studyTypes?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t._count?.tasks ?? 0} tasks)
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {method === "STUDY_TYPE_AS_IS" && selectedStudyType && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-gray-700">
            Task list (review only) — remaining tasks
            {study.tasks.length > 0 && `, after the ${study.tasks.length} already created`}
          </p>
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {remainingTemplateTasks(selectedStudyType).map((t, i, sorted) => (
                <li key={t.id}>
                  {t.groupName && t.groupName !== sorted[i - 1]?.groupName && (
                    <div className="bg-gray-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {t.groupName}
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {t.sequenceNumber}. {t.taskName}
                      {t.isFixed && <span className="ml-2 text-xs text-gray-400">Fixed</span>}
                    </span>
                    <span className="text-gray-400">{t.defaultDurationDays ?? 1} day(s)</span>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}

      {(method === "MODIFIED_TEMPLATE" || method === "FROM_SCRATCH") && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-gray-700">Tasks</p>
          <StudyTaskEditor tasks={tasks} onChange={setTasks} />
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!canSubmit || submitting}>
          {submitting ? "Confirming…" : "Confirm as Sold"}
        </Button>
      </div>
    </Modal>
  );
}

function MarkNotApplicableModal({
  tasks,
  onClose,
  onSaved,
}: {
  tasks: Task[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      for (const task of tasks) {
        await api.post(`/tasks/${task.id}/status`, { status: "NOT_APPLICABLE", version: task.version });
      }
      onSaved(`${tasks.length} task(s) marked Not Applicable.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update one or more tasks.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="Mark Tasks Not Applicable" onClose={onClose}>
      <ErrorBanner message={error} />
      <p className="text-sm text-gray-600">
        Mark these {tasks.length} task(s) as Not Applicable? They&apos;ll be excluded from progress and
        completion calculations.
      </p>
      <ul className="mt-3 max-h-40 overflow-y-auto text-sm text-gray-700">
        {tasks.map((t) => (
          <li key={t.id}>{t.taskName}</li>
        ))}
      </ul>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={confirm} disabled={submitting || tasks.length === 0}>
          {submitting ? "Saving…" : "Mark Not Applicable"}
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
  const options = TASK_STATUS_OPTIONS[task.status].filter(
    (o) => !(o === "NOT_APPLICABLE" && task.isFixed)
  );
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
