// Spec 55: UI display uses user locale; internal storage is ISO (handled server-side).
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function toInputDate(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function formatScheduleVariance(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "On schedule";
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} late`;
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ahead`;
}
