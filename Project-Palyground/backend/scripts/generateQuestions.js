import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDir, "../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Add it to server/.env before running this script.",
  );
}

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const sampleContent = {
  subject: "Physics",
  chapter: "Electrostatics",
  questions: [
    {
      statement:
        "The electric intensity due to an infinite sheet of charge is:",
      options: [
        { text: "σ / ε₀" },
        { text: "σ / 2ε₀" },
        { text: "2σ / ε₀" },
        { text: "σ / 4ε₀" },
      ],
      correctAnswer: "σ / 2ε₀",
      explanation:
        "According to Gauss's Law, the electric field intensity near an infinite sheet of charge is E = sigma / 2epsilon_0.",
    },
  ],
};

async function insertSampleContent() {
  console.log("Adding sample data to Neon Database...");

  const subject = await prisma.subject.upsert({
    where: { name: sampleContent.subject },
    update: {},
    create: { name: sampleContent.subject },
  });

  const existingChapter = await prisma.chapter.findFirst({
    where: {
      name: sampleContent.chapter,
      subjectId: subject.id,
    },
  });

  const chapter =
    existingChapter ||
    (await prisma.chapter.create({
      data: {
        name: sampleContent.chapter,
        subjectId: subject.id,
      },
    }));

  for (const question of sampleContent.questions) {
    await prisma.question.create({
      data: {
        statement: question.statement,
        chapterId: chapter.id,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        options: {
          create: question.options,
        },
      },
    });
  }

  console.log("Sample data successfully injected into Neon.");
}

insertSampleContent()
  .catch((error) => {
    console.error("Error standard injection:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
