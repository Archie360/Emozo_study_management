"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { api, toQuery } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Study, StudyStatus, Paginated } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { StudyStatusBadge, PriorityBadge } from "@/components/Badge";
import { Card, ErrorBanner, inputClass, ProgressBar } from "@/components/ui";

// Spec 30: STUDY List Screen — status filter (default CONFIRMED_SOLD), search.
const STATUS_TABS: (StudyStatus | "ALL")[] = ["CONFIRMED_SOLD", "PROPOSED", "COMPLETE", "CANCELLED", "ALL"];
const STATUS_LABELS: Record<StudyStatus | "ALL", string> = {
  ALL: "All",
  PROPOSED: "Proposed",
  CONFIRMED_SOLD: "Confirmed-Sold",
  COMPLETE: "Complete",
  CANCELLED: "Cancelled",
};

export default function StudiesListPage() {
  const [status, setStatus] = useState<StudyStatus | "ALL">("CONFIRMED_SOLD");
  const [search, setSearch] = useState("");

  const { data, loading, error } = useApi<Paginated<Study>>(
    () =>
      api.get(
        `/studies${toQuery({
          status: status === "ALL" ? undefined : status,
          search: search || undefined,
          page_size: 50,
        })}`
      ),
    [status, search]
  );

  return (
    <AuthGate>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Studies</h1>
        <div className="flex gap-2">
          <Link
            href="/study-types"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Study Types
          </Link>
          <Link href="/studies/new" className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700">
            Create Study
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatus(tab)}
              className={`rounded px-3 py-1 text-sm font-medium ${
                status === tab ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {STATUS_LABELS[tab]}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search name, ID, owner, type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-72 ${inputClass}`}
        />
      </div>

      <ErrorBanner message={error} />

      <Card className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Study</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3">Expected Completion</th>
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
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No studies match this filter.
                </td>
              </tr>
            )}
            {data?.items.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/studies/${s.id}`} className="font-medium text-gray-900 hover:underline">
                    {s.studyName}
                  </Link>
                  <div className="text-xs text-gray-400">{s.studyType?.name ?? "Custom"}</div>
                </td>
                <td className="px-4 py-3">
                  <StudyStatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-gray-600">{s.owner.name}</td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={s.priority} />
                </td>
                <td className="px-4 py-3">
                  <ProgressBar percent={s.metrics.progressPercent} />
                </td>
                <td className="px-4 py-3 text-gray-600">{formatDate(s.currentExpectedCompletionDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AuthGate>
  );
}
