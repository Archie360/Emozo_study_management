"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { api, ApiError } from "@/lib/api";
import { StudyType } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, inputClass } from "@/components/ui";
import { EditableStudyTypeTaskGroup, StudyTypeTaskEditor } from "@/components/StudyTypeTaskEditor";

export default function NewStudyTypePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [taskGroups, setTaskGroups] = useState<EditableStudyTypeTaskGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const studyType = await api.post<StudyType>("/study-types", {
        name,
        description: description || undefined,
        tasks: taskGroups
          .flatMap((g) =>
            g.tasks.map((t) => ({
              taskName: t.taskName,
              description: t.description || undefined,
              groupName: g.groupName || undefined,
              defaultDurationDays: t.defaultDurationDays ? Number(t.defaultDurationDays) : undefined,
              isFixed: t.isFixed,
            }))
          )
          .map((t, i) => ({ ...t, sequenceNumber: i + 1 })),
      });
      router.push(`/study-types/${studyType.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError("Failed to create Study Template.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthGate>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">New Study Template</h1>
      <Card className="max-w-3xl p-6">
        <ErrorBanner message={error} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name *" error={fieldErrors.name}>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Description">
            <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-gray-700">Tasks</p>
          <StudyTypeTaskEditor groups={taskGroups} onChange={setTaskGroups} />
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting || !name}>
            {submitting ? "Creating…" : "Create Study Template"}
          </Button>
        </div>
      </Card>
    </AuthGate>
  );
}
