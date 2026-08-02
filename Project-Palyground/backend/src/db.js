// import "dotenv/config";
// import { neon } from "@neondatabase/serverless";
// import { PrismaNeon } from "@prisma/adapter-neon";
// import { PrismaClient } from "@prisma/client";

// if (!process.env.DATABASE_URL) {
//   throw new Error("DATABASE_URL is missing. Add it to server/.env");
// }

// let sql;

// export function getSql() {
//   if (!sql) {
//     sql = neon(process.env.DATABASE_URL);
//   }

//   return sql;
// }

// export async function checkDatabase() {
//   const rows = await getSql()`select now() as connected_at`;
//   return rows[0];
// }

// const adapter = new PrismaNeon({
//   connectionString: process.env.DATABASE_URL,
// });

// const prisma = new PrismaClient({ adapter });

// export default prisma;
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in environment variables.");
}

// Neon Serverless adapter for Prisma runtime orchestration
const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
