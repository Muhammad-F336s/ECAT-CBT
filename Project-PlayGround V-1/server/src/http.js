export function sendJson(res, statusCode, payload) { // helper to send a JSON response
  const body = JSON.stringify(payload); // serialize payload to JSON string

  res.writeHead(statusCode, { // set status code and headers
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body), // set content length for the response
  });
  res.end(body); // end the response with the JSON body
}

export async function readJson(req) { // read and parse a JSON request body
  const chunks = []; // collect incoming request chunks

  for await (const chunk of req) { // async-iterate over request stream
    chunks.push(chunk);
  }

  if (chunks.length === 0) { // empty body -> return empty object
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")); // parse concatenated buffer as JSON
}

export function applyCors(req, res) { // set minimal CORS headers and handle OPTIONS preflight
  const origin = process.env.CLIENT_ORIGIN || "http://localhost:5173"; // allowed origin default

  res.setHeader("Access-Control-Allow-Origin", origin); // allow requests from configured client origin
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS"); // allowed methods
  res.setHeader("Access-Control-Allow-Headers", "Content-Type"); // allowed headers

  if (req.method === "OPTIONS") { // handle preflight requests immediately
    res.writeHead(204); // no content
    res.end();
    return true; // indicate request was handled
  }

  return false; // request was not a preflight; continue normal handling
}
