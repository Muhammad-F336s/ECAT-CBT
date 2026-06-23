import "dotenv/config"; // load env variables from server/.env into process.env
import { createServer } from "node:http"; // native HTTP server
import { checkDatabase, getSql } from "./db.js"; // DB helpers
import { applyCors, readJson, sendJson } from "./http.js"; // HTTP helper utilities

const port = Number(process.env.PORT || 8787); // server port with default

async function handleRequest(req, res) { // main request handler for the HTTP server
  if (applyCors(req, res)) { // handle CORS preflight and exit early if needed
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`); // parse the request URL

  try {
    if (req.method === "GET" && url.pathname === "/api/health") { // simple health route
      sendJson(res, 200, { ok: true, service: "project-palyground-server" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/db/health") { // DB connectivity check
      const database = await checkDatabase(); // runs a lightweight query
      sendJson(res, 200, { ok: true, database });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/exams") { // fetch exams list
      const exams = await getSql()`
        select id, title, description, duration_minutes, is_active, created_at
        from exams
        order by created_at desc
      `; // run a read-only query using the Neon tagged template

      sendJson(res, 200, { exams }); // return exams array
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/exams") { // create a new exam
      const body = await readJson(req); // parse JSON body
      const title = String(body.title || "").trim(); // sanitize title

      if (!title) { // validate required field
        sendJson(res, 400, { error: "Exam title is required." });
        return;
      }

      const durationMinutes = Number(body.durationMinutes || 60); // default duration
      const rows = await getSql()`
        insert into exams (title, description, duration_minutes)
        values (${title}, ${body.description || null}, ${durationMinutes})
        returning id, title, description, duration_minutes, is_active, created_at
      `; // insert and return the created exam row

      sendJson(res, 201, { exam: rows[0] }); // respond with created resource
      return;
    }

    sendJson(res, 404, { error: "Route not found." }); // fallback: unknown route
  } catch (error) {
    sendJson(res, 500, { error: error.message }); // error handling for unexpected exceptions
  }
}

createServer(handleRequest).listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`); // start server and log URL
});
