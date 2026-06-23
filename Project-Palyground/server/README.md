# Server

This folder contains the Node API and Neon database setup for the CBT project.

## Setup

1. Create a Neon project at https://neon.tech and copy the pooled or direct PostgreSQL connection string.
2. Copy `.env.example` to `.env`.
3. Paste the connection string into `DATABASE_URL`.
4. Install dependencies:

```sh
npm install
```

5. Create the database tables:

```sh
npm run db:setup
```

6. Start the API server:

```sh
npm run dev
```

## API

- `GET /api/health` checks that the API is running.
- `GET /api/db/health` checks that Neon is reachable.
- `GET /api/exams` lists exams.
- `POST /api/exams` creates an exam with `title`, optional `description`, and optional `durationMinutes`.

Keep `DATABASE_URL` in this server folder only. Do not add it to a `VITE_` variable because that would expose it to the browser.
