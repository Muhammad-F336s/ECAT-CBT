# Database Flow — Full Details

This document explains in detail how the database is wired into this project, how SQL is executed, the data model, common pitfalls (including the multi-statement error you saw), and recommended fixes and workflows to avoid problems later.

**Purpose**

- Give a single reference describing: connection lifecycle, query patterns, schema application, data model, and debugging steps.

**Contents**

- Connection and client lifecycle
- Query patterns used in code
- Schema application and `db:setup` behavior
- The data model and relationships
- Common failure modes and root-cause diagnostics
- Recommended fixes and scripts
- Example code fixes (safe logging and robust splitter)

---

## Connection and client lifecycle

- The project uses Neon (Postgres) via the `@neondatabase/serverless` package.
- The PostgreSQL connection string is stored in `server/.env` as `DATABASE_URL` and loaded by `dotenv`.
- `server/src/db.js` exposes two helpers:
  - `getSql()` — creates a Neon client the first time it's called and caches it in a module-level `sql` variable. This avoids repeatedly creating clients/connections.
  - `checkDatabase()` — a small helper that runs a lightweight query (`select now() as connected_at`) to verify connectivity.
- Why caching matters: creating new client instances repeatedly can be inefficient and may exhaust connection pools. Reusing a single client is the recommended pattern for serverless driver usage in this codebase.

## Query patterns used in the code

Two forms are used here:

1. Tagged-template queries (recommended for app code)

   ```js
   const rows = await getSql()`
     select * from exams where id = ${id}
   `;
   ```

   - This uses the Neon tagged template to send a prepared statement with parameter binding.
   - Benefits: prevents SQL injection and ensures safe binding of values.
   - Limitation: the underlying driver treats this as a prepared statement and expects a single SQL statement per call.

2. Raw string queries via `.query()`

   ```js
   await sql.query(statement);
   ```

   - Used by `server/src/setupDatabase.js` to execute schema statements read from a file.
   - `.query()` executes a raw SQL string. Some drivers accept multiple statements, others (or prepared-statement paths) do not.

## Schema application — how `npm run db:setup` works

- `npm run db:setup` runs `node src/setupDatabase.js` (see `server/package.json`).
- `setupDatabase.js` reads `server/sql/schema.sql` as text, splits the text on semicolons `;`, trims pieces, filters empties, and then runs each piece via `sql.query(statement)`.
- Intent: to execute each individual statement separately.

Pitfalls with naive splitting by `;`:

- Dollar-quoted blocks (`$$ ... $$`) used in functions or triggers may contain semicolons which are not statement separators.
- Semicolons inside strings or comments are not real separators either.
- Splitting on `;` without understanding SQL syntax can produce pieces that still contain multiple statements or are invalid SQL.

Why you saw "cannot insert multiple commands into a prepared statement":

- A call reached the driver prepared-statement path with a string containing more than one statement. The driver rejects multiple commands in that prepared statement.
- This commonly happens when a single split piece still contains more than one SQL command, or the driver uses a prepared statement API under the hood for `query()`.

## Data model and relationships (what tables mean)

- `users` — stores user info and role. Primary key: `id` (uuid). `role` values: `student` or `admin`.
- `exams` — exam metadata (title, duration, active flag). `id` is primary key.
- `questions` — `exam_id` references `exams(id)`. Contains prompt, explanation, points, and ordering.
- `choices` — `question_id` references `questions(id)`. Contains choice text and `is_correct` flag.
- `attempts` — `user_id` (optional) and `exam_id`. One row per user attempt. `score` stored here.
- `attempt_answers` — records answers for each `attempt_id` and `question_id`, optional `choice_id`. Unique constraint prevents duplicate answer rows per question per attempt.
- Indexes: indexes exist on FK columns to speed common queries (questions per exam, choices per question, attempts by exam/user).

Typical flow:

1. Create an exam (POST `/api/exams`) → insert into `exams`.
2. Create questions and choices (not implemented in the API yet, but supported in DB).
3. User starts an attempt → insert into `attempts` with `started_at`.
4. User answers questions → insert into `attempt_answers` for each question.
5. On submit, compute score and update `attempts` with `submitted_at` and `score`.

## Common failure modes and how to diagnose them

1. Missing `DATABASE_URL`
   - Symptom: `getSql()` throws an error telling you to set `DATABASE_URL`.
   - Fix: copy `.env.example` to `.env` and add the Neon connection string.

2. Multi-statement error (the one you saw)
   - Symptom: `NeonDbError: cannot insert multiple commands into a prepared statement` (Postgres code `42601`).
   - Diagnosis steps:
     - Edit `server/src/setupDatabase.js` to `console.log()` each `statement` (or log its index and a prefix of content) before running. That shows which piece fails.
     - Wrap execution in try/catch and print the failing fragment to locate the problematic SQL.
     - Alternatively, run the SQL file via `psql` or the Neon dashboard — these accept full files and will show which statement fails with better context.

3. Duplicate run / idempotency issues
   - Symptom: constraints or indexes fail on repeated runs.
   - Mitigation: schema file uses `create table if not exists` and `create index if not exists` to be idempotent for development. For production, use migrations.

4. Race conditions on client creation
   - Symptom: too many connections or errors creating clients in parallel.
   - Mitigation: `getSql()` caches the client to prevent multiple creations; do not re-instantiate in request handlers.

## Recommended fixes and scripts

1. Quick fix: Add logging around schema execution to locate failing statement.
   - Advantages: fastest to implement.

2. Robust fix: Use a SQL-aware splitter that understands dollar-quoted blocks and ignores semicolons inside them, or use a parser library.
   - Implement a simple parser that treats `$$ ... $$` as opaque (skip semicolons inside) before splitting.
   - Or use `pg` or `psql` to apply the whole file in one go (psql is easiest).

3. Best practice (local dev): add an npm script to run the schema via `psql` if developers have the `psql` CLI and prefer that.

Example `package.json` script (optional):

```json
"scripts": {
  "db:apply-file": "psql \"$DATABASE_URL\" -f sql/schema.sql"
}
```

## Example code changes

1. Minimal logging patch for `setupDatabase.js` (quick):

```js
for (const [i, statement] of statements.entries()) {
  console.log(
    `Running statement #${i} (len=${statement.length}):`,
    statement.slice(0, 200),
  );
  try {
    await sql.query(statement);
  } catch (err) {
    console.error("Failed statement #", i);
    console.error(statement);
    throw err;
  }
}
```

2. Safer splitter (basic): This preserves dollar-quoted blocks and splits only on semicolons outside them.

```js
function splitSqlRespectingDollarQuotes(sqlText) {
  const parts = [];
  let buffer = "";
  let i = 0;
  while (i < sqlText.length) {
    if (sqlText[i] === "$" && sqlText.slice(i).match(/^\$[\w]*\$/)) {
      const m = sqlText.slice(i).match(/^\$[\w]*\$/)[0];
      const tag = m; // e.g. $$ or $func$
      const end = sqlText.indexOf(tag, i + tag.length);
      if (end === -1) {
        // unterminated block — include rest
        buffer += sqlText.slice(i);
        break;
      }
      // append the whole dollar-quoted block
      const block = sqlText.slice(i, end + tag.length);
      buffer += block;
      i = end + tag.length;
      continue;
    }

    if (sqlText[i] === ";") {
      parts.push(buffer.trim());
      buffer = "";
      i += 1;
      continue;
    }

    buffer += sqlText[i];
    i += 1;
  }
  if (buffer.trim()) parts.push(buffer.trim());
  return parts.filter(Boolean);
}
```

- Use this to build `statements` instead of `.split(';')`.

## Troubleshooting checklist (fast)

- Check `server/.env` exists and contains `DATABASE_URL`.
- Check the Neon connection string includes `sslmode=require`.
- Run `npm run db:setup` from the `server` folder to confirm the schema can be applied.
- Run the server and test `/api/db/health` to confirm Neon is reachable.
- If `db:setup` fails, check `server/sql/schema.sql` and `server/src/setupDatabase.js`.

---

## Important Commands

Run these commands from PowerShell.

```powershell
cd E:\ECAT-CBT\Project-Palyground
```

Use this to move into the main project folder.

```powershell
cd E:\ECAT-CBT\Project-Palyground\server
```

Use this to move into the backend server folder, where the Neon API code lives.

```powershell
npm.cmd install
```

Use this inside `server` after package changes. It installs only the server dependencies, including `@neondatabase/serverless` and `dotenv`.

```powershell
npm.cmd run db:setup
```

Use this inside `server` to apply `server/sql/schema.sql` to Neon. It creates the required tables and indexes if they do not already exist.

```powershell
npm.cmd run dev
```

Use this inside `server` to start the backend API on `http://localhost:8787`.

```powershell
Invoke-RestMethod "http://localhost:8787/api/health"
```

Use this in a second PowerShell terminal to check that the backend server is running.

```powershell
Invoke-RestMethod "http://localhost:8787/api/db/health"
```

Use this in a second PowerShell terminal to check that the backend can connect to Neon.

```powershell
Invoke-RestMethod "http://localhost:8787/api/exams"
```

Use this to check that the exams API can read from the Neon `exams` table.

```powershell
cd E:\ECAT-CBT\Project-Palyground
npm.cmd run dev
```

Use this from the main project folder to start the React frontend on Vite, usually at `http://localhost:5173`.

```powershell
cd E:\ECAT-CBT\Project-Palyground
npm.cmd run dev:server
```

Use this from the main project folder if you want to start the backend without first moving into the `server` folder.

---

## Prisma Check Commands

Run these commands from PowerShell inside the server folder:

```powershell
cd E:\ECAT-CBT\Project-Palyground\server
```

This moves you into the backend folder where `package.json`, `prisma.config.js`, `prisma/schema.prisma`, and `scripts/seed.js` exist.

```powershell
npm.cmd install
```

Use this first if dependencies are missing or after pulling package changes.

Expected response:

```text
added ... packages
audited ... packages
```

If everything is already installed, npm may say:

```text
up to date, audited ... packages
```

```powershell
npm.cmd run prisma:validate
```

Use this to check that `prisma/schema.prisma` and `prisma.config.js` are valid.

Expected response:

```text
The schema at prisma\schema.prisma is valid
Loaded Prisma config from prisma.config.js.
Prisma schema loaded from prisma\schema.prisma.
```

```powershell
npm.cmd run prisma:generate
```

Use this to generate Prisma Client after changing `schema.prisma` or installing dependencies.

Expected response:

```text
Generated Prisma Client (v7.8.0) to .\node_modules\@prisma\client
Loaded Prisma config from prisma.config.js.
Prisma schema loaded from prisma\schema.prisma.
```

```powershell
npm.cmd run db:setup
```

Use this to create/update the Neon tables from `sql/schema.sql`, including the Prisma tables `"Subject"`, `"Chapter"`, `"Question"`, and `"Option"`.

Expected response:

```text
Neon database schema is ready.
```

```powershell
npm.cmd run prisma:seed
```

Use this to insert the default Prisma seed data. The seed is idempotent, so running it again should not duplicate `Physics`.

Expected response:

```text
Running seed command `node ./scripts/seed.js` ...
Seeding started...
Subject ready: Physics (ID: ...)
Chapter ready: Electrostatics
The seed command has been executed.
Loaded Prisma config from prisma.config.js.
```

```powershell
npm.cmd run prisma:push
```

This tries to push `schema.prisma` directly to the database. In this project, prefer `npm.cmd run db:setup` because Neon pooled connections can make `prisma db push` fail with a schema engine error.

Expected successful response:

```text
Your database is now in sync with your Prisma schema.
```

Possible response in this project:

```text
Error: Schema engine error:
```

If this happens, run:

```powershell
npm.cmd run db:setup
npm.cmd run prisma:seed
```

```powershell
rg --files -g "*.ts"
```

Use this to confirm no TypeScript files remain.

Expected response:

```text
```

No output means there are no `.ts` files. If `rg` exits with code `1`, that is also normal when no files match.

Recommended full Prisma check flow:

```powershell
cd E:\ECAT-CBT\Project-Palyground\server
npm.cmd install
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run db:setup
npm.cmd run prisma:seed
```
