import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash("Admin123!", 12);
  const standardPasswordHash = await bcrypt.hash("User123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: "admin@example.com",
      name: "Admin User",
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
    },
  });

  const standard = await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: { passwordHash: standardPasswordHash },
    create: {
      email: "user@example.com",
      name: "Standard User",
      role: UserRole.STANDARD,
      passwordHash: standardPasswordHash,
    },
  });

  const existingType = await prisma.studyType.findFirst({ where: { name: "Concept Test" } });
  if (!existingType) {
    await prisma.studyType.create({
      data: {
        name: "Concept Test",
        description: "Standard concept testing workflow.",
        createdBy: admin.id,
        tasks: {
          create: [
            { taskName: "Kickoff", sequenceNumber: 1, defaultDurationDays: 2 },
            { taskName: "Fieldwork", sequenceNumber: 2, defaultDurationDays: 10 },
            { taskName: "Analysis", sequenceNumber: 3, defaultDurationDays: 5 },
            { taskName: "Report", sequenceNumber: 4, defaultDurationDays: 3 },
          ],
        },
      },
    });
  }

  console.log("Seed complete:", { admin: admin.email, standard: standard.email });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
