import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseOrThrow } from "./validate";
import { ValidationError } from "./errors";

describe("parseOrThrow", () => {
  const schema = z.object({
    name: z.string().trim().min(1, "Name is required."),
    age: z.number().int().positive(),
  });

  it("returns the parsed value when input is valid", () => {
    expect(parseOrThrow(schema, { name: "Ada", age: 30 })).toEqual({ name: "Ada", age: 30 });
  });

  it("throws a ValidationError, not the raw ZodError, on invalid input", () => {
    expect(() => parseOrThrow(schema, { name: "", age: -1 })).toThrow(ValidationError);
  });

  it("maps each Zod issue to its field path", () => {
    try {
      parseOrThrow(schema, { name: "", age: -1 });
      expect.fail("expected parseOrThrow to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const validationError = err as ValidationError;
      expect(validationError.fields).toMatchObject({
        name: "Name is required.",
      });
      expect(validationError.fields?.age).toBeDefined();
    }
  });

  it("uses '_' as the field key for a root-level (pathless) issue", () => {
    const rootSchema = z.string().refine(() => false, { message: "Always wrong." });
    try {
      parseOrThrow(rootSchema, "anything");
      expect.fail("expected parseOrThrow to throw");
    } catch (err) {
      const validationError = err as ValidationError;
      expect(validationError.fields?._).toBe("Always wrong.");
    }
  });

  it("re-throws non-Zod errors unchanged", () => {
    const throwingSchema = {
      parse() {
        throw new Error("boom");
      },
    } as unknown as z.ZodTypeAny;
    expect(() => parseOrThrow(throwingSchema, {})).toThrow("boom");
  });
});
