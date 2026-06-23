import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Add it to server/.env before running the Prisma seed.");
}

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding started...");

  const physics = await prisma.subject.upsert({
    where: {
      name: "Physics",
    },
    update: {},
    create: {
      name: "Physics",
    },
  });

  console.log(`Subject ready: ${physics.name} (ID: ${physics.id})`);

  const chapter = await prisma.chapter.findFirst({
    where: {
      name: "Electrostatics",
      subjectId: physics.id,
    },
  });

  const electrostatics =
    chapter ||
    (await prisma.chapter.create({
      data: {
        name: "Electrostatics",
        subjectId: physics.id,
      },
    }));

  console.log(`Chapter ready: ${electrostatics.name}`);
}

main()
  .catch((error) => {
    console.error("Error seeding data:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
