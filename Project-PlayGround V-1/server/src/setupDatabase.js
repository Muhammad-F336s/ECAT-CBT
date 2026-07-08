import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

function splitSqlStatements(sqlText) {
  const parts = [];
  let buffer = "";
  let i = 0;

  while (i < sqlText.length) {
    if (sqlText[i] === "$" && sqlText.slice(i).match(/^\$[\w]*\$/)) {
      const tag = sqlText.slice(i).match(/^\$[\w]*\$/)[0];
      const end = sqlText.indexOf(tag, i + tag.length);
      if (end === -1) {
        buffer += sqlText.slice(i);
        break;
      }
      buffer += sqlText.slice(i, end + tag.length);
      i = end + tag.length;
      continue;
    }

    if (sqlText[i] === ";") {
      const trimmed = buffer.trim();
      if (trimmed && !trimmed.startsWith("--")) {
        parts.push(trimmed);
      }
      buffer = "";
      i += 1;
      continue;
    }

    buffer += sqlText[i];
    i += 1;
  }

  const tail = buffer.trim();
  if (tail && !tail.startsWith("--")) {
    parts.push(tail);
  }

  return parts;
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Add it to server/.env before running db:setup.");
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(currentDir, "../sql/schema.sql");
const schema = await readFile(schemaPath, "utf8");
const statements = splitSqlStatements(schema);
const sql = neon(process.env.DATABASE_URL);

for (const [index, statement] of statements.entries()) {
  try {
    await sql.query(statement);
  } catch (error) {
    console.error(`Failed on statement #${index}:`);
    console.error(statement.slice(0, 300));
    throw error;
  }
}

console.log("Neon database schema is ready.");
