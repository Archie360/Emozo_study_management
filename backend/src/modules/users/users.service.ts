import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { NotFoundError, ValidationError } from "../../utils/errors";

export async function listUsers() {
  return prisma.user.findMany({ orderBy: { name: "asc" } });
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("User");
  return user;
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(input: { email: string; name: string; role?: UserRole }) {
  if (!input.email) throw new ValidationError("Email is required.", { email: "Required" });
  if (!input.name) throw new ValidationError("Name is required.", { name: "Required" });

  const existing = await getUserByEmail(input.email);
  if (existing) throw new ValidationError("A user with this email already exists.", { email: "Already in use" });

  return prisma.user.create({
    data: { email: input.email, name: input.name, role: input.role ?? UserRole.STANDARD },
  });
}

// Spec 3.2: Administrator can manage users, including role changes.
export async function updateUserRole(id: string, role: UserRole) {
  await getUser(id);
  return prisma.user.update({ where: { id }, data: { role } });
}
