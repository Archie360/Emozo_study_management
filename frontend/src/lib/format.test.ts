import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatDateTime, formatScheduleVariance, toInputDate } from "./format";

describe("formatDate", () => {
  it("renders a falsy value as an em dash", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("renders an unparseable string as an em dash", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("renders a valid ISO date with month, day, and year", () => {
    const result = formatDate("2026-03-15T00:00:00.000Z");
    expect(result).toContain("2026");
    expect(result).toMatch(/Mar/i);
  });
});

describe("formatDateTime", () => {
  it("renders a falsy value as an em dash", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("")).toBe("—");
  });

  it("renders an unparseable string as an em dash", () => {
    expect(formatDateTime("not-a-date")).toBe("—");
  });

  it("renders a valid ISO timestamp with date and time", () => {
    const result = formatDateTime("2026-03-15T14:30:00.000Z");
    expect(result).toContain("2026");
    expect(result).toMatch(/Mar/i);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("toInputDate", () => {
  it("returns an empty string for a falsy value", () => {
    expect(toInputDate(null)).toBe("");
    expect(toInputDate(undefined)).toBe("");
  });

  it("truncates an ISO datetime down to its date portion", () => {
    expect(toInputDate("2026-03-15T10:30:00.000Z")).toBe("2026-03-15");
  });

  it("leaves an already-short date string untouched", () => {
    expect(toInputDate("2026-03-15")).toBe("2026-03-15");
  });
});

describe("formatScheduleVariance", () => {
  it("renders null as an em dash", () => {
    expect(formatScheduleVariance(null)).toBe("—");
  });

  it("renders 0 as on schedule", () => {
    expect(formatScheduleVariance(0)).toBe("On schedule");
  });

  it("renders a positive value as late, with correct pluralization", () => {
    expect(formatScheduleVariance(1)).toBe("1 day late");
    expect(formatScheduleVariance(5)).toBe("5 days late");
  });

  it("renders a negative value as ahead, with correct pluralization", () => {
    expect(formatScheduleVariance(-1)).toBe("1 day ahead");
    expect(formatScheduleVariance(-5)).toBe("5 days ahead");
  });
});

describe("formatCurrency", () => {
  it("renders a null or undefined value as an em dash", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
  });

  it("renders an unparseable value as an em dash", () => {
    expect(formatCurrency("not-a-number")).toBe("—");
  });

  it("defaults to USD when no currency is given", () => {
    const result = formatCurrency("1234");
    expect(result).toContain("1,234");
    expect(result).toContain("$");
  });

  it("formats using the given currency code", () => {
    // Digit grouping follows the resolved locale (en-US here), not the
    // currency — INR's lakh-style grouping only shows up under an en-IN
    // locale. The currency symbol is what this is actually checking.
    const result = formatCurrency("500000", "INR");
    expect(result).toContain("₹");
    expect(result).toContain("500,000");
  });

  it("drops fractional amounts (maximumFractionDigits: 0)", () => {
    expect(formatCurrency("99.99")).not.toContain(".99");
  });
});
