"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Priority, Study, StudyType, TaskCreationMethod, User } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, inputClass } from "@/components/ui";
import { EditableTask, StudyTaskEditor } from "@/components/StudyTaskEditor";

interface StudyForm {
  studyName: string;
  studyTypeId: string;
  ownerUserId: string;
  emozoPoc: string;
  description: string;
  clientName: string;
  clientLocation: string;
  sponsorInfo: string;
  clientBusinessUnit: string;
  priority: Priority | "";
  originalStartDate: string;
  originalCompletionDate: string;
  likelyTotalRevenue: string;
  estimatedTotalExpenses: string;
}

const EMPTY_FORM: StudyForm = {
  studyName: "",
  studyTypeId: "",
  ownerUserId: "",
  emozoPoc: "",
  description: "",
  clientName: "",
  clientLocation: "",
  sponsorInfo: "",
  clientBusinessUnit: "",
  priority: "",
  originalStartDate: "",
  originalCompletionDate: "",
  likelyTotalRevenue: "",
  estimatedTotalExpenses: "",
};

// Chains dates sequentially from the study's start date using each template
// task's default_duration_days — same algorithm the backend uses when
// copying a Study Type as-is.
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
        groupName: t.groupName ?? "",
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      };
    });
}

// A Study is defined first (status PROPOSED). The task-creation method is
// chosen here, once: STUDY_TYPE_AS_IS instantiates the Project Type's first
// task group now and defers the rest to the Study detail page's "Confirm as
// Sold" action (no further choice needed there — see that page for why);
// Modify Template / From Scratch create every given task immediately.
export default function CreateStudyPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<StudyForm>(EMPTY_FORM);
  const [method, setMethod] = useState<TaskCreationMethod>("STUDY_TYPE_AS_IS");
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: studyTypes } = useApi<StudyType[]>(() => api.get("/study-types?status=ACTIVE"), []);
  const { data: users } = useApi<User[]>(() => api.get("/users"), []);
  const { data: selectedStudyType } = useApi<StudyType | null>(
    () => (form.studyTypeId ? api.get(`/study-types/${form.studyTypeId}`) : Promise.resolve(null)),
    [form.studyTypeId]
  );

  function goToStep2() {
    setError(null);
    if (
      !form.studyName ||
      !form.studyTypeId ||
      !form.ownerUserId ||
      !form.originalStartDate ||
      !form.originalCompletionDate
    ) {
      setError("Please complete all required fields before continuing.");
      return;
    }
    if (form.originalCompletionDate < form.originalStartDate) {
      setError("Original Completion Date cannot be earlier than Original Start Date.");
      return;
    }
    setStep(2);
  }

  function selectMethod(value: TaskCreationMethod) {
    setMethod(value);
    if (value === "MODIFIED_TEMPLATE" && selectedStudyType) {
      setTasks(seedTasksFromStudyType(selectedStudyType, form.originalStartDate));
    } else if (value === "FROM_SCRATCH") {
      setTasks([]);
    }
  }

  async function handleSubmit() {
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const payload = {
        studyName: form.studyName,
        studyTypeId: form.studyTypeId,
        ownerUserId: form.ownerUserId,
        emozoPoc: form.emozoPoc || undefined,
        description: form.description || undefined,
        clientName: form.clientName || undefined,
        clientLocation: form.clientLocation || undefined,
        sponsorInfo: form.sponsorInfo || undefined,
        clientBusinessUnit: form.clientBusinessUnit || undefined,
        priority: form.priority || undefined,
        originalStartDate: form.originalStartDate,
        originalCompletionDate: form.originalCompletionDate,
        likelyTotalRevenue: form.likelyTotalRevenue ? Number(form.likelyTotalRevenue) : undefined,
        estimatedTotalExpenses: form.estimatedTotalExpenses ? Number(form.estimatedTotalExpenses) : undefined,
        taskCreationMethod: method,
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
      ? true
      : tasks.length > 0 && tasks.every((t) => t.taskName && t.startDate && t.endDate);

  return (
    <AuthGate>
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Create Study</h1>
      <p className="mb-6 text-sm text-gray-500">
        Step {step} of 2 — {step === 1 ? "Define the Study" : "Choose how to build its Tasks"}
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
            <Field label="Project Type *" error={fieldErrors.studyTypeId}>
              <select
                className={inputClass}
                value={form.studyTypeId}
                onChange={(e) => setForm({ ...form, studyTypeId: e.target.value })}
              >
                <option value="">Select Project Type…</option>
                {studyTypes?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
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
            <Field label="Emozo PoC">
              <input
                className={inputClass}
                value={form.emozoPoc}
                onChange={(e) => setForm({ ...form, emozoPoc: e.target.value })}
              />
            </Field>
            <Field label="Likely Start Date *">
              <input
                type="date"
                className={inputClass}
                value={form.originalStartDate}
                onChange={(e) => setForm({ ...form, originalStartDate: e.target.value })}
              />
            </Field>
            <Field label="Likely Completion Date *" error={fieldErrors.originalCompletionDate}>
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
            <Field label="Client / Business Unit">
              <input
                className={inputClass}
                value={form.clientBusinessUnit}
                onChange={(e) => setForm({ ...form, clientBusinessUnit: e.target.value })}
              />
            </Field>
            <Field label="Client Name">
              <input
                className={inputClass}
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              />
            </Field>
            <Field label="Client Location">
              <input
                className={inputClass}
                value={form.clientLocation}
                onChange={(e) => setForm({ ...form, clientLocation: e.target.value })}
              />
            </Field>
            <Field label="Sponsor Info">
              <input
                className={inputClass}
                value={form.sponsorInfo}
                onChange={(e) => setForm({ ...form, sponsorInfo: e.target.value })}
              />
            </Field>
            <Field label="Likely Total Revenue">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.likelyTotalRevenue}
                onChange={(e) => setForm({ ...form, likelyTotalRevenue: e.target.value })}
              />
            </Field>
            <Field label="Estimated Total Expenses">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.estimatedTotalExpenses}
                onChange={(e) => setForm({ ...form, estimatedTotalExpenses: e.target.value })}
              />
            </Field>
            <Field label="Description (2-3 sentences)">
              <input
                className={inputClass}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={goToStep2}>Continue</Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="max-w-3xl p-6">
          <div className="space-y-2">
            {(
              [
                ["STUDY_TYPE_AS_IS", "Use the Project Type's tasks as-is (recommended)"],
                ["MODIFIED_TEMPLATE", "Start with the Project Type's tasks and modify them"],
                ["FROM_SCRATCH", "Build Tasks from scratch"],
              ] as [TaskCreationMethod, string][]
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="method"
                  checked={method === value}
                  onChange={() => selectMethod(value)}
                />
                {label}
              </label>
            ))}
          </div>

          {method === "STUDY_TYPE_AS_IS" && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-gray-700">
                Only the first task group is created now; the rest is created automatically when this
                Study is later confirmed as sold.
              </p>
              {selectedStudyType?.tasks && (
                <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
                  {[...selectedStudyType.tasks]
                    .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
                    .map((t, i, sorted) => (
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
              )}
            </div>
          )}

          {(method === "MODIFIED_TEMPLATE" || method === "FROM_SCRATCH") && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-gray-700">
                Tasks (all created now — there&apos;s no separate confirm-sold step for these)
              </p>
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
