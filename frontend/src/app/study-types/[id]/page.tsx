"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { StudyType, StudyTypeTask } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, inputClass, SuccessToast } from "@/components/ui";

// Spec 35: STUDY TYPE Edit Screen. Saving changes affects future Studies
// only — existing Studies were already copied and are independent (spec 65).
export default function StudyTypeEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data: studyType, loading, error, reload } = useApi<StudyType>(
    () => api.get(`/study-types/${id}`),
    [id]
  );
  const [toast, setToast] = useState<string | null>(null);

  function notify(message: string) {
    reload();
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  if (loading) return <AuthGate><p className="text-sm text-gray-500">Loading…</p></AuthGate>;
  if (error || !studyType) return <AuthGate><ErrorBanner message={error ?? "Study Type not found."} /></AuthGate>;

  const isArchived = studyType.status === "ARCHIVED";
  const tasks = [...(studyType.tasks ?? [])].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  return (
    <AuthGate>
      <SuccessToast message={toast} />
      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-xl font-semibold text-gray-900">{studyType.name}</h1>
        {isArchived && (
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-300">
            ARCHIVED
          </span>
        )}
      </div>

      {isArchived && (
        <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Archived Study Types cannot be edited. They remain visible for reference; existing Studies
          created from them are unaffected (spec 5, 47).
        </div>
      )}

      <NameDescriptionForm studyType={studyType} disabled={isArchived} onSaved={() => notify("Study Type updated.")} />

      <h2 className="mb-2 mt-8 text-sm font-semibold text-gray-700">Tasks</h2>
      <div className="space-y-2">
        {tasks.length === 0 && (
          <p className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
            No tasks yet.
          </p>
        )}
        {tasks.map((task, index) => (
          <div key={task.id}>
            {task.groupName && task.groupName !== tasks[index - 1]?.groupName && (
              <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400 first:mt-0">
                {task.groupName}
              </p>
            )}
            <TaskRow
              studyTypeId={studyType.id}
              task={task}
              index={index}
              count={tasks.length}
              allTasks={tasks}
              disabled={isArchived}
              onSaved={notify}
            />
          </div>
        ))}
      </div>

      {!isArchived && (
        <div className="mt-4">
          <AddTaskForm studyTypeId={studyType.id} onSaved={() => notify("Task added.")} />
        </div>
      )}
    </AuthGate>
  );
}

function NameDescriptionForm({
  studyType,
  disabled,
  onSaved,
}: {
  studyType: StudyType;
  disabled: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState(studyType.name);
  const [description, setDescription] = useState(studyType.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dirty = name !== studyType.name || description !== (studyType.description ?? "");

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/study-types/${studyType.id}`, { name, description, version: studyType.version });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <ErrorBanner message={error} />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name">
          <input className={inputClass} value={name} disabled={disabled} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <input
            className={inputClass}
            value={description}
            disabled={disabled}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>
      {!disabled && dirty && (
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function TaskRow({
  studyTypeId,
  task,
  index,
  count,
  allTasks,
  disabled,
  onSaved,
}: {
  studyTypeId: string;
  task: StudyTypeTask;
  index: number;
  count: number;
  allTasks: StudyTypeTask[];
  disabled: boolean;
  onSaved: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [taskName, setTaskName] = useState(task.taskName);
  const [description, setDescription] = useState(task.description ?? "");
  const [groupName, setGroupName] = useState(task.groupName ?? "");
  const [duration, setDuration] = useState(String(task.defaultDurationDays ?? 1));
  const [isFixed, setIsFixed] = useState(task.isFixed);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/study-types/${studyTypeId}/tasks/${task.id}`, {
        taskName,
        description,
        groupName: groupName || undefined,
        defaultDurationDays: duration ? Number(duration) : undefined,
        isFixed,
      });
      setEditing(false);
      onSaved("Task updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${task.taskName}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/study-types/${studyTypeId}/tasks/${task.id}`);
      onSaved("Task deleted.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete.");
      setBusy(false);
    }
  }

  async function move(direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= count) return;
    const reordered = [...allTasks];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setBusy(true);
    setError(null);
    try {
      await api.post(`/study-types/${studyTypeId}/tasks/reorder`, {
        tasks: reordered.map((t, i) => ({ task_id: t.id, sequence: i + 1 })),
      });
      onSaved("Tasks reordered.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reorder.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-gray-200 p-3">
      <ErrorBanner message={error} />
      <div className="flex items-start gap-2">
        {!disabled && (
          <div className="flex flex-col pt-1 text-gray-400">
            <button onClick={() => move(-1)} disabled={index === 0 || busy} className="disabled:opacity-30">
              ▲
            </button>
            <button onClick={() => move(1)} disabled={index === count - 1 || busy} className="disabled:opacity-30">
              ▼
            </button>
          </div>
        )}
        {editing ? (
          <div className="grid flex-1 grid-cols-12 gap-2">
            <input
              className={`${inputClass} col-span-2`}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group"
            />
            <input className={`${inputClass} col-span-3`} value={taskName} onChange={(e) => setTaskName(e.target.value)} />
            <input
              className={`${inputClass} col-span-3`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
            />
            <input
              type="number"
              min={1}
              className={`${inputClass} col-span-2`}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <label className="col-span-2 flex items-center gap-1 text-xs text-gray-500" title="Cannot be marked Not Applicable">
              <input type="checkbox" checked={isFixed} onChange={(e) => setIsFixed(e.target.checked)} />
              Fixed
            </label>
          </div>
        ) : (
          <div className="flex-1 text-sm">
            <span className="font-medium text-gray-900">
              {task.sequenceNumber}. {task.taskName}
            </span>
            {task.description && <span className="ml-2 text-gray-400">{task.description}</span>}
            <span className="ml-2 text-gray-400">· {task.defaultDurationDays ?? 1} day(s)</span>
            {task.isFixed && <span className="ml-2 text-gray-400">· Fixed</span>}
          </div>
        )}
        {!disabled && (
          <div className="flex gap-2 pt-0.5 text-xs">
            {editing ? (
              <>
                <button className="text-gray-600 hover:underline" onClick={save} disabled={busy}>
                  Save
                </button>
                <button className="text-gray-400 hover:underline" onClick={() => setEditing(false)} disabled={busy}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button className="text-gray-600 hover:underline" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button className="text-red-500 hover:underline" onClick={remove} disabled={busy}>
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AddTaskForm({ studyTypeId, onSaved }: { studyTypeId: string; onSaved: () => void }) {
  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [groupName, setGroupName] = useState("");
  const [duration, setDuration] = useState("1");
  const [isFixed, setIsFixed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function add() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/study-types/${studyTypeId}/tasks`, {
        taskName,
        description: description || undefined,
        groupName: groupName || undefined,
        defaultDurationDays: duration ? Number(duration) : undefined,
        isFixed,
      });
      setTaskName("");
      setDescription("");
      setDuration("1");
      setIsFixed(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add task.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-md border border-dashed border-gray-300 p-3">
      <ErrorBanner message={error} />
      <div className="grid grid-cols-12 gap-2">
        <input
          className={`${inputClass} col-span-2`}
          placeholder="Group"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />
        <input
          className={`${inputClass} col-span-3`}
          placeholder="New task name"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
        />
        <input
          className={`${inputClass} col-span-3`}
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          type="number"
          min={1}
          className={`${inputClass} col-span-1`}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <label className="col-span-1 flex items-center justify-center gap-1 text-xs text-gray-500" title="Cannot be marked Not Applicable">
          <input type="checkbox" checked={isFixed} onChange={(e) => setIsFixed(e.target.checked)} />
          Fixed
        </label>
        <Button className="col-span-2" onClick={add} disabled={submitting || !taskName}>
          + Add
        </Button>
      </div>
    </div>
  );
}
