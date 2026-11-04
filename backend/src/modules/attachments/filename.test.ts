import { describe, expect, it } from "vitest";
import { sanitizeFileName } from "./filename";

describe("sanitizeFileName", () => {
  it("leaves an already-safe filename unchanged", () => {
    expect(sanitizeFileName("report-v2.final.pdf")).toBe("report-v2.final.pdf");
  });

  it("replaces unsafe characters with underscores", () => {
    expect(sanitizeFileName("weird/name:here?.png")).toBe("weird_name_here_.png");
  });

  it("keeps spaces", () => {
    expect(sanitizeFileName("quarterly summary.docx")).toBe("quarterly summary.docx");
  });

  it("truncates very long filenames to 200 characters", () => {
    const name = "a".repeat(300) + ".txt";
    const result = sanitizeFileName(name);
    expect(result.length).toBe(200);
  });

  it("falls back to 'file' when the name sanitizes to nothing", () => {
    expect(sanitizeFileName("")).toBe("file");
  });
});
