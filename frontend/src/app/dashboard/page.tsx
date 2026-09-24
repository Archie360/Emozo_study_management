"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { api, toQuery } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ActiveStudyReportItem, Paginated } from "@/lib/types";
import { formatDate, formatScheduleVariance } from "@/lib/format";
import { Card, ErrorBanner, inputClass, ProgressBar } from "@/components/ui";

const SORT_OPTIONS = [
  { value: "last_updated:desc", label: "Last Updated" },
  { value: "study_name:asc", label: "Study Name" },
  { value: "expected_completion:asc", label: "Expected Completion" },
  { value: "priority:desc", label: "Priority" },
];

// Spec 27-29: Active Studies Dashboard — filters, sorting, calculated columns.
export default function DashboardPage() {
  const [sort, setSort] = useState(SORT_OPTIONS[0].value);
  const [search, setSearch] = useState("");

  const { data, loading, error } = useApi<Paginated<ActiveStudyReportItem>>(
    () => api.get(`/reports/active-studies${toQuery({ sort, page_size: 50 })}`),
    [sort]
  );

  const items = search
    ? data?.items.filter((s) => s.studyName.toLowerCase().includes(search.toLowerCase()))
    : data?.items;

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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className={inputClass}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </select>
      </div>

      <ErrorBanner message={error} />

      <Card className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Study</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3">Current Stage</th>
              <th className="px-4 py-3">Original Completion</th>
              <th className="px-4 py-3">Expected Completion</th>
              <th className="px-4 py-3">Schedule Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && items?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
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
