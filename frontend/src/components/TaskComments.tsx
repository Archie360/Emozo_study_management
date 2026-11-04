"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { TaskComment } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { Button, Card, ErrorBanner, inputClass } from "@/components/ui";

// Shared by the Task Detail page and the "Notes" dialog on the Study page —
// same thread, same actions, just a different container around it.
export function TaskComments({
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
    <div>
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
    </div>
  );
}

// Small speech-bubble glyph for the "open notes" affordance beside a task
// name — kept as inline SVG rather than a unicode/emoji character so it
// stays crisp and visually neutral at tiny sizes.
export function NoteIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M4 4.5h12a1 1 0 0 1 1 1V13a1 1 0 0 1-1 1H9l-3.5 3V14H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      <path d="M6.5 8h7M6.5 10.5h4.5" strokeLinecap="round" />
    </svg>
  );
}
