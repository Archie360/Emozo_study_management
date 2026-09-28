"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { api, toQuery } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ActiveStudyReportItem, Paginated } from "@/lib/types";
import { formatDate, formatScheduleVariance } from "@/lib/format";
import { Card, ErrorBanner, inputClass, ProgressBar } from "@/components/ui";

type SortKey = "studyName" | "owner" | "progress" | "currentStage" | "originalCompletion" | "expectedCompletion" | "scheduleVariance";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "studyName", label: "Study" },
  { key: "owner", label: "Owner" },
  { key: "progress", label: "Progress" },
  { key: "currentStage", label: "Current Stage" },
  { key: "originalCompletion", label: "Original Completion" },
  { key: "expectedCompletion", label: "Expected Completion" },
  { key: "scheduleVariance", label: "Schedule Variance" },
];

function sortValue(item: ActiveStudyReportItem, key: SortKey): string | number {
  switch (key) {
    case "studyName":
      return item.studyName.toLowerCase();
    case "owner":
      return item.owner.name.toLowerCase();
    case "progress":
      return item.progressPercent;
    case "currentStage":
      return item.currentStage.toLowerCase();
    case "originalCompletion":
      return item.originalCompletion ?? "";
    case "expectedCompletion":
      return item.expectedCompletion ?? "";
    case "scheduleVariance":
      return item.scheduleVarianceDays ?? 0;
  }
}

// Spec 27-29: Active Studies Dashboard — filters, sorting, calculated columns.
// The report is fetched in full (up to 50 rows, no further pagination in
// this UI), so sorting happens client-side on whatever column is clicked —
// that covers computed columns like Progress and Current Stage too, which
// have no backing DB column to sort by server-side.
export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("expectedCompletion");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data, loading, error } = useApi<Paginated<ActiveStudyReportItem>>(
    () => api.get(`/reports/active-studies${toQuery({ page_size: 50 })}`),
    []
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const items = useMemo(() => {
    const filtered = search
      ? data?.items.filter((s) => s.studyName.toLowerCase().includes(search.toLowerCase()))
      : data?.items;
    if (!filtered) return filtered;
    const sorted = [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, search, sortKey, sortDir]);

  return (
    <AuthGate>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Active Studies Dashboard</h1>
          <p className="text-sm text-gray-500">Progress and expected completion across all active studies.</p>
        </div>
        <Link href="/studies/new" className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700">
          Create Study
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search study name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-64 ${inputClass}`}
        />
      </div>

      <ErrorBanner message={error} />

      <Card className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-1 hover:text-gray-700"
                  >
                    {col.label}
                    <span className="text-gray-300">
                      {sortKey === col.key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-6 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && items?.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-6 text-center text-gray-400">
                  No active studies.
                </td>
              </tr>
            )}
            {items?.map((s) => (
              <tr key={s.studyId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/studies/${s.studyId}`} className="font-medium text-gray-900 hover:underline">
                    {s.studyName}
                  </Link>
                  <div className="text-xs text-gray-400">{s.studyType?.name ?? "Custom"}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{s.owner.name}</td>
                <td className="px-4 py-3">
                  <ProgressBar percent={s.progressPercent} />
                  <div className="mt-0.5 text-xs text-gray-400">
                    {s.completedTasks}/{s.totalTasks} tasks
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{s.currentStage}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(s.originalCompletion)}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(s.expectedCompletion)}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      s.scheduleVarianceDays && s.scheduleVarianceDays > 0
                        ? "text-red-600"
                        : s.scheduleVarianceDays && s.scheduleVarianceDays < 0
                        ? "text-green-600"
                        : "text-gray-600"
                    }
                  >
                    {formatScheduleVariance(s.scheduleVarianceDays)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AuthGate>
  );
}
