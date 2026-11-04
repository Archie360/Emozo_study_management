"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/lib/auth";
import { Task, TaskComment, TaskDateHistoryEntry, TaskStatusHistoryEntry, Study } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { TaskStatusBadge } from "@/components/Badge";
import { Button, Card, ErrorBanner, inputClass } from "@/components/ui";
import { Breadcrumbs } from "@/components/Breadcrumbs";

type TaskDetail = Task & { study: Study };

// Spec 32-33: TASK Detail Screen — full date and status history, newest first.
export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: task, loading, error } = useApi<TaskDetail>(() => api.get(`/tasks/${id}`), [id]);
  const { data: dateHistory } = useApi<TaskDateHistoryEntry[]>(
    () => api.get(`/tasks/${id}/date-history`),
    [id]
  );
  const { data: statusHistory } = useApi<TaskStatusHistoryEntry[]>(
    () => api.get(`/tasks/${id}/status-history`),
    [id]
  );
  const { data: comments, reload: reloadComments } = useApi<TaskComment[]>(
    () => api.get(`/tasks/${id}/comments`),
    [id]
  );

  if (loading) return <AuthGate><p className="text-sm text-gray-500">Loading…</p></AuthGate>;
  if (error || !task) return <AuthGate><ErrorBanner message={error ?? "Task not found."} /></AuthGate>;

  return (
    <AuthGate>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Studies", href: "/studies" },
          { label: task.study.studyName, href: `/studies/${task.study.id}` },
          { label: task.taskName },
        ]}
      />

      <Card className="mb-6 p-6">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">{task.taskName}</h1>
          <TaskStatusBadge status={task.status} />
        </div>
        {task.description && <p className="mb-4 text-sm text-gray-500">{task.description}</p>}
        <dl className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-4">
          <Item label="Sequence" value={String(task.sequenceNumber)} />
          <Item label="Current Start" value={formatDate(task.currentStartDate)} />
          <Item label="Current End" value={formatDate(task.currentEndDate)} />
          <Item label="Date Change Count" value={String(task.dateChangeCount)} />
          <Item label="Previous Start" value={formatDate(task.previousStartDate)} />
          <Item label="Previous End" value={formatDate(task.previousEndDate)} />
          <Item label="Completed" value={formatDate(task.completedAt)} />
        </dl>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Date History</h2>
          <Card className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2">Ver</th>
                  <th className="px-3 py-2">Previous</th>
                  <th className="px-3 py-2">New</th>
                  <th className="px-3 py-2">Changed By</th>
                  <th className="px-3 py-2">Changed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(!dateHistory || dateHistory.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                      No previous dates.
                    </td>
                  </tr>
                )}
                {dateHistory?.map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-2 text-gray-500">{h.versionNumber}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {formatDate(h.previousStartDate)} → {formatDate(h.previousEndDate)}
                    </td>
                    <td className="px-3 py-2 text-gray-900">
                      {formatDate(h.newStartDate)} → {formatDate(h.newEndDate)}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{h.changer.name}</td>
                    <td className="px-3 py-2 text-gray-400">{formatDate(h.changedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Status History</h2>
          <Card className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2">Previous</th>
                  <th className="px-3 py-2">New</th>
                  <th className="px-3 py-2">Changed By</th>
                  <th className="px-3 py-2">Changed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(!statusHistory || statusHistory.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
                      No status changes yet.
                    </td>
                  </tr>
                )}
                {statusHistory?.map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-2">
                      <TaskStatusBadge status={h.previousStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <TaskStatusBadge status={h.newStatus} />
                    </td>
                    <td className="px-3 py-2 text-gray-500">{h.changer.name}</td>
                    <td className="px-3 py-2 text-gray-400">{formatDate(h.changedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Notes</h2>
        <TaskComments taskId={task.id} comments={comments ?? []} onChange={reloadComments} />
      </div>
    </AuthGate>
  );
}

function TaskComments({
  taskId,
  comments,
  onChange,
}: {
  taskId: string;
  comments: TaskComment[];
  onChange: () => void;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function addComment() {
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/tasks/${taskId}/comments`, { body });
      setBody("");
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add note.");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeComment(commentId: string) {
    setDeletingId(commentId);
    setError(null);
    try {
      await api.delete(`/tasks/${taskId}/comments/${commentId}`);
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete note.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="p-4">
      <ErrorBanner message={error} />
      {comments.length === 0 && <p className="text-sm text-gray-400">No notes yet.</p>}
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded-md border border-gray-100 bg-gray-50 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">{c.author.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{formatDateTime(c.createdAt)}</span>
                {(user?.id === c.authorId || user?.role === "ADMIN") && (
                  <button
                    onClick={() => removeComment(c.id)}
                    disabled={deletingId === c.id}
                    className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                    title="Delete note"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{c.body}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-2">
        <textarea
          className={`${inputClass} min-h-[2.5rem] flex-1`}
          placeholder="Add a note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
        />
        <Button onClick={addComment} disabled={submitting || !body.trim()}>
          {submitting ? "Posting…" : "Post"}
        </Button>
      </div>
    </Card>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}
