"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Priority, Study, StudyType, TaskCreationMethod, User } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, inputClass, Modal } from "@/components/ui";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EditableTaskGroup, StudyTaskEditor } from "@/components/StudyTaskEditor";
import { CURRENCIES } from "@/lib/currencies";

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
  currency: string;
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
  currency: "USD",
  likelyTotalRevenue: "",
  estimatedTotalExpenses: "",
};

// Chains dates sequentially from the study's start date using each template
// task's default_duration_days — same algorithm the backend uses when
// copying a Study Type as-is. Consecutive tasks sharing a groupName are
// chunked into the same group block.
function seedGroupsFromStudyType(studyType: StudyType, startDate: string): EditableTaskGroup[] {
  if (!startDate || !studyType.tasks) return [];
  let cursor = new Date(startDate);
  const groups: EditableTaskGroup[] = [];
  for (const t of [...studyType.tasks].sort((a, b) => a.sequenceNumber - b.sequenceNumber)) {
    const duration = t.defaultDurationDays ?? 1;
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + Math.max(duration - 1, 0));
    cursor = new Date(end);
    cursor.setDate(cursor.getDate() + 1);

    const groupName = t.groupName ?? "";
    let group = groups[groups.length - 1];
    if (!group || group.groupName !== groupName) {
      group = { groupId: crypto.randomUUID(), groupName, tasks: [] };
      groups.push(group);
    }
    group.tasks.push({
      tempId: crypto.randomUUID(),
      taskName: t.taskName,
      description: t.description ?? "",
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    });
  }
  return groups;
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
  const [taskGroups, setTaskGroups] = useState<EditableTaskGroup[]>([]);
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
      setTaskGroups(seedGroupsFromStudyType(selectedStudyType, form.originalStartDate));
    } else if (value === "FROM_SCRATCH") {
      setTaskGroups([]);
    }
  }

  const [confirming, setConfirming] = useState(false);

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
        currency: form.currency,
        likelyTotalRevenue: form.likelyTotalRevenue ? Number(form.likelyTotalRevenue) : undefined,
        estimatedTotalExpenses: form.estimatedTotalExpenses ? Number(form.estimatedTotalExpenses) : undefined,
        taskCreationMethod: method,
        tasks:
          method === "STUDY_TYPE_AS_IS"
            ? undefined
            : taskGroups.flatMap((g) =>
                g.tasks.map((t) => ({
                  taskName: t.taskName,
                  description: t.description || undefined,
                  groupName: g.groupName || undefined,
                  startDate: t.startDate,
                  endDate: t.endDate,
                }))
              ).map((t, i) => ({ ...t, sequenceNumber: i + 1 })),
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

  const allTasks = taskGroups.flatMap((g) => g.tasks);
  const canSubmit =
    method === "STUDY_TYPE_AS_IS"
      ? true
      : allTasks.length > 0 && allTasks.every((t) => t.taskName && t.startDate && t.endDate);

  return (
    <AuthGate>
      <Breadcrumbs
        items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Studies", href: "/studies" }, { label: "Create Study" }]}
      />
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
            <Field label="Study Type *" error={fieldErrors.studyTypeId}>
              <select
                className={inputClass}
                value={form.studyTypeId}
                onChange={(e) => setForm({ ...form, studyTypeId: e.target.value })}
              >
                <option value="">Select Study Type…</option>
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
            <Field label="Currency">
              <select
                className={inputClass}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <div />
            <Field label={`Likely Total Revenue (${form.currency})`}>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.likelyTotalRevenue}
                onChange={(e) => setForm({ ...form, likelyTotalRevenue: e.target.value })}
              />
            </Field>
            <Field label={`Estimated Total Expenses (${form.currency})`}>
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
                          <span className="text-gray-900">
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
              <StudyTaskEditor groups={taskGroups} onChange={setTaskGroups} />
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setConfirming(true)} disabled={!canSubmit || submitting}>
              Create Study
            </Button>
          </div>
        </Card>
      )}

      {confirming && (
        <Modal open title="Create this Study?" onClose={() => setConfirming(false)}>
          <ErrorBanner message={error} />
          <p className="text-sm text-gray-600">
            This creates <strong>{form.studyName || "(untitled)"}</strong>
            {selectedStudyType && (
              <>
                {" "}
                under <strong>{selectedStudyType.name}</strong>
              </>
            )}
            , owned by <strong>{users?.find((u) => u.id === form.ownerUserId)?.name ?? "—"}</strong>, running{" "}
            {form.originalStartDate || "—"} to {form.originalCompletionDate || "—"}.
            {method === "STUDY_TYPE_AS_IS"
              ? " Its first task group will be created now; the rest follow once it's confirmed as sold."
              : ` It will be created with ${allTasks.length} task(s).`}
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating…" : "Create Study"}
            </Button>
          </div>
        </Modal>
      )}

    </AuthGate>
  );
}
