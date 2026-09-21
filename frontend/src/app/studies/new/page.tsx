"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Priority, Study, StudyType, StudyTypeStatus, User } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, inputClass } from "@/components/ui";
import { EditableTask, StudyTaskEditor } from "@/components/StudyTaskEditor";
import { formatDate } from "@/lib/format";

type TaskCreationMethod = "STUDY_TYPE_AS_IS" | "MODIFIED_TEMPLATE" | "FROM_SCRATCH";

interface StudyForm {
  studyName: string;
  ownerUserId: string;
  description: string;
  clientBusinessUnit: string;
  priority: Priority | "";
  status: "DRAFT" | "ACTIVE";
  originalStartDate: string;
  originalCompletionDate: string;
}

const EMPTY_FORM: StudyForm = {
  studyName: "",
  ownerUserId: "",
  description: "",
  clientBusinessUnit: "",
  priority: "",
  status: "DRAFT",
  originalStartDate: "",
  originalCompletionDate: "",
};

// Chains dates sequentially from the study's start date using each template
// task's default_duration_days — the same algorithm the backend uses when
// copying a Study Type as-is (see backend copyStudyTypeTasksAsIs), so the
// "modify" preview starts from what "as-is" would have produced.
function seedTasksFromStudyType(studyType: StudyType, startDate: string): EditableTask[] {
  if (!startDate || !studyType.tasks) return [];
  let cursor = new Date(startDate);
  return [...studyType.tasks]
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
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
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      };
    });
}

export default function CreateStudyPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<StudyForm>(EMPTY_FORM);
  const [method, setMethod] = useState<TaskCreationMethod>("STUDY_TYPE_AS_IS");
  const [studyTypeId, setStudyTypeId] = useState("");
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: studyTypes } = useApi<StudyType[]>(
    () => api.get(`/study-types?status=${"ACTIVE" satisfies StudyTypeStatus}`),
    []
  );
  const { data: users } = useApi<User[]>(() => api.get("/users"), []);
  const { data: selectedStudyType } = useApi<StudyType | null>(
    () => (studyTypeId ? api.get(`/study-types/${studyTypeId}`) : Promise.resolve(null)),
    [studyTypeId]
  );

  function goToStep2() {
    setError(null);
    if (!form.studyName || !form.ownerUserId || !form.originalStartDate || !form.originalCompletionDate) {
      setError("Please complete all required fields before continuing.");
      return;
    }
    if (form.originalCompletionDate < form.originalStartDate) {
      setError("Original Completion Date cannot be earlier than Original Start Date.");
      return;
    }
    setStep(2);
  }

  function selectStudyTypeForModify(type: StudyType) {
    setStudyTypeId(type.id);
    setTasks(seedTasksFromStudyType(type, form.originalStartDate));
  }

  async function handleSubmit() {
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const payload = {
        studyName: form.studyName,
        ownerUserId: form.ownerUserId,
        description: form.description || undefined,
        clientBusinessUnit: form.clientBusinessUnit || undefined,
        priority: form.priority || undefined,
        status: form.status,
        originalStartDate: form.originalStartDate,
        originalCompletionDate: form.originalCompletionDate,
        taskCreationMethod: method,
        studyTypeId: method === "FROM_SCRATCH" ? undefined : studyTypeId,
        tasks:
          method === "STUDY_TYPE_AS_IS"
            ? undefined
            : tasks.map((t, i) => ({
                taskName: t.taskName,
                description: t.description || undefined,
                startDate: t.startDate,
                endDate: t.endDate,
                sequenceNumber: i + 1,
              })),
      };
      const study = await api.post<Study>("/studies", payload);
      router.push(`/studies/${study.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError("Failed to create study.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    method === "STUDY_TYPE_AS_IS"
      ? !!studyTypeId
      : tasks.length > 0 && tasks.every((t) => t.taskName && t.startDate && t.endDate);

  return (
    <AuthGate>
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Create Study</h1>
      <p className="mb-6 text-sm text-gray-500">
        Step {step} of 2 — {step === 1 ? "Define the Study" : "Create the Study Tasks"}
      </p>

      <ErrorBanner message={error} />

      {step === 1 && (
        <Card className="max-w-2xl p-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Study Name *" error={fieldErrors.studyName}>
              <input
                className={inputClass}
                value={form.studyName}
                onChange={(e) => setForm({ ...form, studyName: e.target.value })}
              />
            </Field>
            <Field label="Owner *" error={fieldErrors.ownerUserId}>
              <select
                className={inputClass}
                value={form.ownerUserId}
                onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}
              >
                <option value="">Select owner…</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Original Start Date *">
              <input
                type="date"
                className={inputClass}
                value={form.originalStartDate}
                onChange={(e) => setForm({ ...form, originalStartDate: e.target.value })}
              />
            </Field>
            <Field label="Original Completion Date *" error={fieldErrors.originalCompletionDate}>
              <input
                type="date"
                className={inputClass}
                value={form.originalCompletionDate}
                onChange={(e) => setForm({ ...form, originalCompletionDate: e.target.value })}
              />
            </Field>
            <Field label="Priority">
              <select
                className={inputClass}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
              >
                <option value="">—</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </Field>
            <Field label="Status *">
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as "DRAFT" | "ACTIVE" })}
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
              </select>
            </Field>
            <Field label="Client / Business Unit">
              <input
                className={inputClass}
                value={form.clientBusinessUnit}
                onChange={(e) => setForm({ ...form, clientBusinessUnit: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <input
                className={inputClass}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-4">
            <p className="mb-2 text-sm font-medium text-gray-700">
              How would you like to create the Study Tasks?
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
                    name="method"
                    checked={method === value}
                    onChange={() => {
                      setMethod(value);
                      setStudyTypeId("");
                      setTasks([]);
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={goToStep2}>Continue</Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="max-w-3xl p-6">
          {(method === "STUDY_TYPE_AS_IS" || method === "MODIFIED_TEMPLATE") && (
            <Field label="Study Type *" error={fieldErrors.studyTypeId}>
              <select
                className={inputClass}
                value={studyTypeId}
                onChange={(e) => {
                  const type = studyTypes?.find((t) => t.id === e.target.value);
                  if (!type) return;
                  if (method === "MODIFIED_TEMPLATE") {
                    selectStudyTypeForModify(type);
                  } else {
                    setStudyTypeId(type.id);
                  }
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
          )}

          {method === "STUDY_TYPE_AS_IS" && selectedStudyType && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-gray-700">Task list (review only)</p>
              <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
                {selectedStudyType.tasks
                  ?.sort((a, b) => a.sequenceNumber - b.sequenceNumber)
                  .map((t) => (
                    <li key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>
                        {t.sequenceNumber}. {t.taskName}
                      </span>
                      <span className="text-gray-400">{t.defaultDurationDays ?? 1} day(s)</span>
                    </li>
                  ))}
              </ul>
              <p className="mt-2 text-xs text-gray-400">
                Task dates will be scheduled sequentially from {formatDate(form.originalStartDate)}.
              </p>
            </div>
          )}

          {(method === "MODIFIED_TEMPLATE" || method === "FROM_SCRATCH") && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-gray-700">Tasks</p>
              <StudyTaskEditor tasks={tasks} onChange={setTasks} />
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting ? "Creating…" : "Create Study"}
            </Button>
          </div>
        </Card>
      )}
    </AuthGate>
  );
}
