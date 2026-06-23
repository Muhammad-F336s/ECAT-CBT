import "dotenv/config"; // load environment variables from server/.env into process.env
import { readFile } from "node:fs/promises"; // async file read utility
import { fileURLToPath } from "node:url"; // convert import.meta.url to a file path
import { dirname, resolve } from "node:path"; // path helpers to build file system paths
import { getSql } from "./db.js"; // function that returns the Neon/Postgres client

const currentDir = dirname(fileURLToPath(import.meta.url)); // directory of this script file
const schemaPath = resolve(currentDir, "../sql/schema.sql"); // path to the SQL schema file in server/sql
const schema = await readFile(schemaPath, "utf8"); // read the whole SQL file as a UTF-8 string
const statements = schema
  .split(";") // split the file into semicolon-separated statements
  .map((statement) => statement.trim()) // trim whitespace from each extracted statement
  .filter(Boolean); // remove empty strings resulting from trailing semicolons or blank lines

const sql = getSql(); // create or reuse the Neon client using DATABASE_URL

for (const statement of statements) { // iterate over each SQL statement
  await sql.query(statement); // execute each statement separately against the DB
}

console.log("Neon database schema is ready."); // confirm that schema setup finished successfully
