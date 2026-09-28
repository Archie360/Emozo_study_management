"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Priority, Study, StudyType, User } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, inputClass } from "@/components/ui";

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

// A Study is defined first (status PROPOSED) with just its info fields — no
// tasks yet. Tasks only get created later, from the Study detail page's
// "Confirm as Sold" action, once the contract is inked.
export default function CreateStudyPage() {
  const router = useRouter();
  const [form, setForm] = useState<StudyForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: studyTypes } = useApi<StudyType[]>(() => api.get("/study-types?status=ACTIVE"), []);
  const { data: users } = useApi<User[]>(() => api.get("/users"), []);

  async function handleSubmit() {
    setError(null);
    setFieldErrors({});
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

  return (
    <AuthGate>
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Create Study</h1>
      <p className="mb-6 text-sm text-gray-500">
        Defines the Study as PROPOSED. Tasks get created later, once it&apos;s confirmed as sold.
      </p>

      <ErrorBanner message={error} />

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
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating…" : "Create Study"}
          </Button>
        </div>
      </Card>
    </AuthGate>
  );
}
