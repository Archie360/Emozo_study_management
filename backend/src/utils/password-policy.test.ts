import { describe, expect, it } from "vitest";
import { checkPasswordStrength } from "./password-policy";

describe("checkPasswordStrength", () => {
  it("accepts a password that satisfies every rule", () => {
    expect(checkPasswordStrength("Tr0ub4dor&3xyz")).toEqual([]);
  });

  it("flags a password that is too short", () => {
    expect(checkPasswordStrength("Ab1!")).toContain("Must be at least 10 characters");
  });

  it("flags missing character classes independently", () => {
    expect(checkPasswordStrength("alllowercase1!")).toContain("Must include an uppercase letter");
    expect(checkPasswordStrength("ALLUPPERCASE1!")).toContain("Must include a lowercase letter");
    expect(checkPasswordStrength("NoDigitsHere!!")).toContain("Must include a number");
    expect(checkPasswordStrength("NoSpecialChar123")).toContain(
      "Must include a special character (e.g. ! @ # $ %)"
    );
  });

  it("reports every unmet rule at once, not just the first", () => {
    expect(checkPasswordStrength("abc")).toEqual([
      "Must be at least 10 characters",
      "Must include an uppercase letter",
      "Must include a number",
      "Must include a special character (e.g. ! @ # $ %)",
    ]);
  });

  it("rejects passwords on the common-password blocklist regardless of case", () => {
    expect(checkPasswordStrength("Password123")).toContain(
      "This password is too common — choose something less guessable"
    );
  });

  it("rejects a password containing the user's email local-part", () => {
    const problems = checkPasswordStrength("Archishman1!", { email: "archishman@example.com" });
    expect(problems).toContain("Must not contain your email address");
  });

  it("rejects a password containing part of the user's name", () => {
    const problems = checkPasswordStrength("Archishman1!", { name: "Archishman Gupta" });
    expect(problems).toContain("Must not contain your name");
  });

  it("does not flag short (<3 char) email/name fragments as matches", () => {
    const problems = checkPasswordStrength("Ab1!defghij", { email: "ab@example.com", name: "Ab" });
    expect(problems).not.toContain("Must not contain your email address");
    expect(problems).not.toContain("Must not contain your name");
  });
});
