# Server folder structure and responsibilities

This document explains the files inside the `server/` folder and what each one does. It helps you understand the server-side hierarchy and where to look for code when you want to change behavior.

- `.env` — environment variables for the server (not checked into git). Put your `DATABASE_URL` here.
- `package.json` — Node project metadata and npm scripts. Key scripts:
  - `dev`: run server in watch mode (`node --watch src/index.js`)
  - `start`: run the server (`node src/index.js`)
  - `db:setup`: run the schema setup script (`node src/setupDatabase.js`)
- `README.md` — quick setup and usage instructions for the server.
- `sql/schema.sql` — the Postgres schema used to create tables and indexes. This file is applied by `src/setupDatabase.js`.
- `src/` — server source code (main runtime):
  - `src/index.js` — HTTP server and route handlers. Routes: `/api/health`, `/api/db/health`, `/api/exams` (GET and POST).
  - `src/db.js` — database client helper. Exposes `getSql()` to get the Neon client and `checkDatabase()` for a lightweight connectivity check.
  - `src/http.js` — small HTTP utilities for reading JSON, sending JSON responses, and applying CORS.
  - `src/setupDatabase.js` — reads `sql/schema.sql` and runs each SQL statement to create tables/indexes.

Notes and tips:
- Keep `DATABASE_URL` local in this `server/.env` file; do not expose it to the frontend.
- If `npm run db:setup` fails with a multi-statement error, open `sql/schema.sql` and ensure statements are separated properly; the project runs each semicolon-separated statement individually.
- For schema changes, prefer editing `sql/schema.sql` and re-running `npm run db:setup` on an empty database, or use a migration tool for production.
