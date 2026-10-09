// Keep in sync with backend/src/utils/currencies.ts.
export const CURRENCIES = [
  { code: "USD", label: "USD ($)" },
  { code: "INR", label: "INR (₹)" },
  { code: "EUR", label: "EUR (€)" },
  { code: "GBP", label: "GBP (£)" },
  { code: "AED", label: "AED" },
  { code: "SGD", label: "SGD (S$)" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
