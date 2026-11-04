"use client";

import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Attachment } from "@/lib/types";
import { Button, ErrorBanner } from "@/components/ui";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Shared by the Study page's "Attachments" section, the per-task Attachments
// dialog, and the Task Detail page — same list/upload/delete behavior, just
// pointed at a different upload URL (study- or task-scoped).
export function Attachments({
  uploadUrl,
  attachments,
  onChange,
}: {
  uploadUrl: string;
  attachments: Attachment[];
  onChange: () => void;
}) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be picked again later
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await api.upload(uploadUrl, file);
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      await api.delete(`/attachments/${id}`);
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete attachment.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />
      {attachments.length === 0 && <p className="text-sm text-gray-400">No attachments yet.</p>}
      <ul className="space-y-2">
        {attachments.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
          >
            {a.contentType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt={a.fileName} className="h-10 w-10 shrink-0 rounded object-cover" />
            ) : (
              <FileIcon className="h-10 w-10 shrink-0 text-gray-300" />
            )}
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 truncate font-medium text-gray-900 hover:underline"
            >
              {a.fileName}
            </a>
            <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">
              {formatBytes(a.sizeBytes)} · {a.uploadedBy.name}
            </span>
            {(user?.id === a.uploadedById || user?.role === "ADMIN") && (
              <button
                onClick={() => removeAttachment(a.id)}
                disabled={deletingId === a.id}
                className="shrink-0 text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                title="Delete attachment"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "+ Add Attachment"}
        </Button>
      </div>
    </div>
  );
}

function FileIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M5 2.5h7l3.5 3.5V16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      <path d="M12 2.5V6h3.5" strokeLinejoin="round" />
    </svg>
  );
}

// Small paperclip glyph for the "open attachments" affordance beside a task
// name on the Study page, mirroring NoteIcon's treatment there.
export function PaperclipIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path
        d="M13.5 6.5 8.3 11.7a2 2 0 1 0 2.83 2.83l5.19-5.2a3.6 3.6 0 1 0-5.09-5.09L5.6 9.89a5.1 5.1 0 1 0 7.21 7.21"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
