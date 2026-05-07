const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp"
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), "utf8");
}

function readStore() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    console.error("readStore error:", e);
    return {};
  }
}

function writeStore(store) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function safePathFromUrlPath(urlPathname) {
  let reqPath = decodeURIComponent(urlPathname);
  if (reqPath === "/") reqPath = "/index.html";
  const abs = path.normalize(path.join(ROOT, reqPath));
  if (!abs.startsWith(ROOT)) return null;
  return abs;
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/store") {
    return sendJson(res, 200, { ok: true, data: readStore() });
  }
  if (req.method === "PUT" && pathname === "/api/store") {
    try {
      const body = await parseBody(req);
      const incoming = body && body.data && typeof body.data === "object" ? body.data : null;
      if (!incoming) return sendJson(res, 400, { ok: false, error: "Body must include object data" });
      const store = readStore();
      const merged = { ...store, ...incoming };
      writeStore(merged);
      return sendJson(res, 200, { ok: true, mergedKeys: Object.keys(incoming).length });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message || "Bad request" });
    }
  }

  const prefix = "/api/store/";
  if (!pathname.startsWith(prefix)) return false;

  const key = decodeURIComponent(pathname.slice(prefix.length)).trim();
  if (!key) return sendJson(res, 400, { ok: false, error: "Missing key" });

  if (req.method === "GET") {
    const store = readStore();
    return sendJson(res, 200, { ok: true, key, value: store[key] ?? null });
  }

  if (req.method === "PUT") {
    try {
      const body = await parseBody(req);
      const store = readStore();
      store[key] = body.value;
      writeStore(store);
      return sendJson(res, 200, { ok: true, key });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message || "Bad request" });
    }
  }

  if (req.method === "DELETE") {
    const store = readStore();
    delete store[key];
    writeStore(store);
    return sendJson(res, 200, { ok: true, key });
  }

  return sendJson(res, 405, { ok: false, error: "Method not allowed" });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    const pathname = parsed.pathname;

    if (pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, pathname);
      if (handled === false) sendJson(res, 404, { ok: false, error: "Not found" });
      return;
    }

    const filePath = safePathFromUrlPath(pathname);
    if (!filePath) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (e) {
    console.error("Server error:", e);
    sendJson(res, 500, { ok: false, error: "Internal server error" });
  }
});

server.listen(PORT, HOST, () => {
  ensureDataFile();
  console.log(`Blog project server running at http://${HOST}:${PORT}`);
});
