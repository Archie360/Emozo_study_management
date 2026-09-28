"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { StudyType } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Button, Card, ErrorBanner } from "@/components/ui";
import { useState } from "react";

// Spec 34: STUDY TYPE Management list — view/edit/duplicate/archive.
export default function StudyTypesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: types, loading, error, reload } = useApi<StudyType[]>(() => api.get("/study-types"), []);
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(type: StudyType) {
    const studyCount = type._count?.studies ?? 0;
    const warning =
      studyCount > 0
        ? ` ${studyCount} existing Stud${studyCount === 1 ? "y" : "ies"} built from it will show "Custom" as their type afterward — their own tasks are unaffected.`
        : "";
    if (!confirm(`Delete "${type.name}"? This cannot be undone.${warning}`)) return;
    try {
      await api.delete(`/study-types/${type.id}`);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete.");
    }
  }

  async function duplicate(id: string) {
    try {
      const copy = await api.post<StudyType>(`/study-types/${id}/duplicate`);
      router.push(`/study-types/${copy.id}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to duplicate.");
    }
  }

  const isAdmin = user?.role === "ADMIN";

  return (
    <AuthGate>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Study Types</h1>
        {isAdmin && (
          <Link href="/study-types/new" className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700">
            New Study Type
          </Link>
        )}
      </div>

      <ErrorBanner message={error ?? actionError} />

      <Card className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Tasks</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Updated</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {types?.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link href={`/study-types/${t.id}`} className="hover:underline">
                    {t.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{t.description ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{t._count?.tasks ?? 0}</td>
                <td className="px-4 py-3 text-gray-600">{t.status}</td>
                <td className="px-4 py-3 text-gray-400">{formatDate(t.updatedAt)}</td>
                <td className="px-4 py-3">
                  {isAdmin && (
                    <div className="flex gap-3">
                      <button className="text-xs text-gray-600 hover:underline" onClick={() => duplicate(t.id)}>
                        Duplicate
                      </button>
                      <Button variant="danger" className="!px-2 !py-0.5 text-xs" onClick={() => remove(t)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AuthGate>
  );
}
