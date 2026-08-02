import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Add it to server/.env before running db:setup.");
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(currentDir, "../sql/schema.sql");
const schema = await readFile(schemaPath, "utf8");
const sql = neon(process.env.DATABASE_URL);

try {
  console.log("Applying database schema...");
  await sql.query(schema);
  console.log("Neon database schema is ready.");
} catch (error) {
  console.error("Failed to apply database schema:");
  console.error(error);
  process.exit(1);
}
