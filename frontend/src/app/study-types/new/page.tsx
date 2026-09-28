"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { api, ApiError } from "@/lib/api";
import { StudyType } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, inputClass } from "@/components/ui";
import { EditableStudyTypeTask, StudyTypeTaskEditor } from "@/components/StudyTypeTaskEditor";

export default function NewStudyTypePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tasks, setTasks] = useState<EditableStudyTypeTask[]>([]);
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
        tasks: tasks.map((t, i) => ({
          taskName: t.taskName,
          description: t.description || undefined,
          sequenceNumber: i + 1,
          defaultDurationDays: t.defaultDurationDays ? Number(t.defaultDurationDays) : undefined,
          isFixed: t.isFixed,
        })),
      });
      router.push(`/study-types/${studyType.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError("Failed to create Study Type.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthGate>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">New Study Type</h1>
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
          <StudyTypeTaskEditor tasks={tasks} onChange={setTasks} />
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting || !name}>
            {submitting ? "Creating…" : "Create Study Type"}
          </Button>
        </div>
      </Card>
    </AuthGate>
  );
}
