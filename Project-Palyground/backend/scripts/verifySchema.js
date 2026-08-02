import "dotenv/config";
import prisma from "../src/db.js";

const tables = await prisma.$queryRaw`
  SELECT table_name::text AS table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`;

const required = ["User", "Admin", "LoginMessage", "TestAttempt", "Subject", "Chapter", "Question", "Option"];
const found = tables.map((t) => t.table_name);

console.log("Tables in database:");
found.forEach((name) => console.log(`  - ${name}`));

const missing = required.filter((name) => !found.includes(name));
if (missing.length) {
  console.error("\nMissing required tables:", missing.join(", "));
  process.exit(1);
}

console.log("\nAll required Prisma tables are present.");
await prisma.$disconnect();
