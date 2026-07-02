import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL || "muhammad.f336s@gmail.com";
  const name = process.env.ADMIN_NAME || "Muhammad F336S";
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SECRET_CODE;

  if (!password || !secret) {
    throw new Error(
      "ADMIN_PASSWORD and ADMIN_SECRET_CODE must be set in environment variables.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const secretHash = await bcrypt.hash(secret, 10);

  const result = await prisma.admin.upsert({
    where: { email },
    update: {
      name,
      password: passwordHash,
      secretHash,
    },
    create: {
      name,
      email,
      password: passwordHash,
      secretHash,
    },
  });

  console.log("updated-admin", JSON.stringify(result));
}

main()
  .catch((error) => {
    console.error("update-admin-error", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
