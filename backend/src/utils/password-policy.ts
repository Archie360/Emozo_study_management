// Pure password-strength check, kept separate from users.service.ts so it's
// trivially unit-testable without touching Prisma/bcrypt.

const MIN_LENGTH = 10;

// A short blocklist of the passwords that show up at the top of every public
// breach-list analysis — these would otherwise sail through the
// length/character-class checks (e.g. "Password123!").
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "qwertyuiop",
  "letmein123",
  "welcome123",
  "admin12345",
  "iloveyou12",
  "monkey1234",
  "dragon1234",
  "sunshine12",
]);

export interface PasswordCheckContext {
  email?: string;
  name?: string;
}

// Returns the list of unmet requirements (empty = strong enough). Checked
// independently, rather than short-circuited, so the caller can show every
// problem at once instead of making the user resubmit repeatedly.
export function checkPasswordStrength(
  password: string,
  context: PasswordCheckContext = {}
): string[] {
  const problems: string[] = [];

  if (password.length < MIN_LENGTH) {
    problems.push(`Must be at least ${MIN_LENGTH} characters`);
  }
  if (!/[a-z]/.test(password)) {
    problems.push("Must include a lowercase letter");
  }
  if (!/[A-Z]/.test(password)) {
    problems.push("Must include an uppercase letter");
  }
  if (!/[0-9]/.test(password)) {
    problems.push("Must include a number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    problems.push("Must include a special character (e.g. ! @ # $ %)");
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    problems.push("This password is too common — choose something less guessable");
  }

  const lowerPassword = password.toLowerCase();
  const localPart = context.email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && lowerPassword.includes(localPart)) {
    problems.push("Must not contain your email address");
  }
  const nameParts = context.name?.toLowerCase().split(/\s+/).filter((p) => p.length >= 3) ?? [];
  if (nameParts.some((part) => lowerPassword.includes(part))) {
    problems.push("Must not contain your name");
  }

  return problems;
}
