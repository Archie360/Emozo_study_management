// Spec 55: UI display uses user locale; internal storage is ISO (handled server-side).
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Full precision, fixed to UTC — unlike formatDate (display-only, user
// locale), a history timestamp needs to read the same regardless of the
// viewer's timezone and down to the second, since two log entries can land
// in the same minute.
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `${date}, ${time} UTC`;
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

export function formatCurrency(value: string | null | undefined, currency: string = "USD"): string {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 0 });
}
