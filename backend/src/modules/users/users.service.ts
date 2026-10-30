import bcrypt from "bcryptjs";
import { Prisma, User, UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { NotFoundError, ValidationError } from "../../utils/errors";
import { checkPasswordStrength, PasswordCheckContext } from "../../utils/password-policy";

const SALT_ROUNDS = 12;

// Never let a passwordHash leave this module — every function that returns
// user data to a route handler goes through this first.
function sanitizeUser<T extends User>(user: T): Omit<T, "passwordHash"> {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

// For any OTHER module that includes a User relation (Study.owner,
// TaskDateHistory.changer, ...): select this instead of `{ <relation>: true }`,
// which would otherwise pull passwordHash into the response.
export const USER_SUMMARY_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listUsers() {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return users.map(sanitizeUser);
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("User");
  return user;
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

function assertValidPassword(
  password: string | undefined,
  context: PasswordCheckContext = {}
): asserts password is string {
  if (!password) {
    throw new ValidationError("Password is required.", { password: "Required" });
  }
  const problems = checkPasswordStrength(password, context);
  if (problems.length > 0) {
    throw new ValidationError("Password does not meet the strength requirements.", {
      password: problems.join("; "),
    });
  }
}

export async function createUser(input: { email: string; name: string; password?: string; role?: UserRole }) {
  if (!input.email) throw new ValidationError("Email is required.", { email: "Required" });
  if (!input.name) throw new ValidationError("Name is required.", { name: "Required" });
  assertValidPassword(input.password, { email: input.email, name: input.name });

  const existing = await getUserByEmail(input.email);
  if (existing) throw new ValidationError("A user with this email already exists.", { email: "Already in use" });

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email: input.email, name: input.name, role: input.role ?? UserRole.STANDARD, passwordHash },
  });
  return sanitizeUser(user);
}

// Spec 3.2: Administrator can manage users, including role changes.
export async function updateUserRole(id: string, role: UserRole) {
  await getUser(id);
  const user = await prisma.user.update({ where: { id }, data: { role } });
  return sanitizeUser(user);
}

export async function updateUser(id: string, input: { name?: string; email?: string }) {
  await getUser(id);
  if (input.name !== undefined && !input.name.trim()) {
    throw new ValidationError("Name is required.", { name: "Required" });
  }
  if (input.email !== undefined) {
    if (!input.email.trim()) throw new ValidationError("Email is required.", { email: "Required" });
    const existing = await getUserByEmail(input.email);
    if (existing && existing.id !== id) {
      throw new ValidationError("A user with this email already exists.", { email: "Already in use" });
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: { name: input.name, email: input.email },
  });
  return sanitizeUser(user);
}

export async function resetUserPassword(id: string, password: string) {
  const existing = await getUser(id);
  assertValidPassword(password, { email: existing.email, name: existing.name });
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.update({ where: { id }, data: { passwordHash } });
  return sanitizeUser(user);
}

// Deleting a user who owns/created studies, tasks, etc. hits foreign-key
// constraints on those records (owner/createdBy are ON DELETE RESTRICT, by
// design — that history shouldn't silently disappear). Surfaced as a
// friendly validation error rather than a raw DB error.
export async function deleteUser(id: string, requestingUserId: string) {
  if (id === requestingUserId) {
    throw new ValidationError("You cannot delete your own account.");
  }
  await getUser(id);

  try {
    await prisma.user.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new ValidationError(
        "This user owns or created studies, tasks, or other records and cannot be deleted. Reassign their work first."
      );
    }
    throw err;
  }
}

export async function verifyLogin(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user || !user.passwordHash) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return sanitizeUser(user);
}
