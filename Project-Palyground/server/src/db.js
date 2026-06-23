import "dotenv/config"; // load environment variables from server/.env into process.env
import { neon } from "@neondatabase/serverless"; // Neon serverless Postgres client

let sql; // cached client instance shared across imports

export function getSql() { // return a Neon client, creating it on first call
  if (!process.env.DATABASE_URL) { // ensure the DATABASE_URL env variable is present
    throw new Error("DATABASE_URL is missing. Copy server/.env.example to server/.env and add your Neon connection string.");
  }

  if (!sql) { // if no client exists yet, create one using the connection string
    sql = neon(process.env.DATABASE_URL);
  }

  return sql; // return the cached or newly created client
}

export async function checkDatabase() { // simple helper to verify DB connectivity
  const rows = await getSql()`select now() as connected_at`; // run a lightweight query using the tagged template
  return rows[0]; // return the first row containing connection time
}
