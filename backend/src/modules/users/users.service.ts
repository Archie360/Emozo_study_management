import bcrypt from "bcryptjs";
import { User, UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { NotFoundError, ValidationError } from "../../utils/errors";

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

// Never let a passwordHash leave this module — every function that returns
// user data to a route handler goes through this first.
function sanitizeUser<T extends User>(user: T): Omit<T, "passwordHash"> {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

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

function assertValidPassword(password: string | undefined): asserts password is string {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, {
      password: `Must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  }
}

export async function createUser(input: { email: string; name: string; password?: string; role?: UserRole }) {
  if (!input.email) throw new ValidationError("Email is required.", { email: "Required" });
  if (!input.name) throw new ValidationError("Name is required.", { name: "Required" });
  assertValidPassword(input.password);

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

export async function verifyLogin(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user || !user.passwordHash) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return sanitizeUser(user);
}
