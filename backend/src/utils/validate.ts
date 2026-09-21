import { z, ZodError, ZodTypeAny } from "zod";
import { ValidationError } from "./errors";

// Parses `input` against `schema`, converting Zod issues into the
// field-specific validation messages required by spec section 53.
// `S extends ZodTypeAny` + `z.infer<S>` (rather than a bare `ZodType<T>`
// parameter) keeps inference of defaulted/optional fields accurate.
export function parseOrThrow<S extends ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  try {
    return schema.parse(input);
  } catch (err) {
    if (err instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".") || "_";
        fields[key] = issue.message;
      }
      throw new ValidationError("Validation failed.", fields);
    }
    throw err;
  }
}
