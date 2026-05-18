import { createReadStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 4173);
const sessionsPath = resolve(root, ".gemini-branch-sessions.json");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  if (url.pathname === "/api/sessions") {
    if (request.method === "GET") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(readSessions()));
      return;
    }

    if (request.method === "PUT") {
      try {
        const body = await readBody(request);
        const parsed = JSON.parse(body || "{}");
        writeSessions(parsed);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true }));
      } catch (error) {
        response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: false, error: error.message }));
      }
      return;
    }
  }

  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = resolve(root, `.${pathname}`);

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Gemini Branch Mindmap is running at http://127.0.0.1:${port}`);
});

function readSessions() {
  if (!existsSync(sessionsPath)) return { activeSessionId: "", sessions: [] };
  try {
    const data = JSON.parse(readFileSync(sessionsPath, "utf8"));
    return {
      activeSessionId: data.activeSessionId || "",
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
    };
  } catch {
    return { activeSessionId: "", sessions: [] };
  }
}

function writeSessions(data) {
  if (!Array.isArray(data.sessions)) throw new Error("sessions must be an array");
  const clean = {
    activeSessionId: data.activeSessionId || data.sessions[0]?.id || "",
    sessions: data.sessions,
  };
  writeFileSync(sessionsPath, JSON.stringify(clean, null, 2), "utf8");
}

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        request.destroy();
        rejectBody(new Error("request body is too large"));
      }
    });
    request.on("end", () => resolveBody(body));
    request.on("error", rejectBody);
  });
}
