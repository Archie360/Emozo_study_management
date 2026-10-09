// Shared between studies.validation.ts (server-side allow-list) and the
// frontend (dropdown options + symbols). Keep both in sync if this changes.
export const CURRENCY_CODES = ["USD", "INR", "EUR", "GBP", "AED", "SGD"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];
