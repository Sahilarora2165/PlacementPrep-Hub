const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const mysql = require("mysql2/promise");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const SCHEMA_FILE = path.join(ROOT, "schema.sql");
const ENV_FILE = path.join(ROOT, ".env");

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return;
  const lines = fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "placementprep",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: false
};

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

const db = mysql.createPool(DB_CONFIG);

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
      if (body.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
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

function normalizeRole(role) {
  return String(role || "").toLowerCase() === "admin" ? "admin" : "user";
}

function sanitizeUser(user, includePassword = false) {
  const next = {
    fullName: String(user.fullName || "").trim(),
    email: String(user.email || "").trim().toLowerCase(),
    bio: String(user.bio || ""),
    expertise: String(user.expertise || ""),
    role: normalizeRole(user.role)
  };
  if (includePassword) next.password = String(user.password || "");
  return next;
}

function splitSqlStatements(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replaceAll("`", "``")}\``;
}

async function ensureDatabase() {
  const bootstrap = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password
  });

  try {
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(DB_CONFIG.database)} DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`
    );
    await bootstrap.query(`USE ${quoteIdentifier(DB_CONFIG.database)}`);

    const schema = fs.readFileSync(SCHEMA_FILE, "utf8");
    for (const statement of splitSqlStatements(schema)) {
      if (/^CREATE\s+DATABASE\b/i.test(statement) || /^USE\b/i.test(statement)) continue;
      await bootstrap.query(statement);
    }
  } finally {
    await bootstrap.end();
  }
}

async function getCommentsWithReplies(postId) {
  const [comments] = await db.query(
    "SELECT id, postId, name, email, comment, date FROM comments WHERE postId = ? ORDER BY id ASC",
    [postId]
  );
  if (!comments.length) return [];

  const ids = comments.map((comment) => comment.id);
  const [replies] = await db.query(
    "SELECT id, commentId, name, text, date FROM replies WHERE commentId IN (?) ORDER BY id ASC",
    [ids]
  );
  const repliesByComment = replies.reduce((map, reply) => {
    if (!map[reply.commentId]) map[reply.commentId] = [];
    map[reply.commentId].push(reply);
    return map;
  }, {});

  return comments.map((comment) => ({
    ...comment,
    replies: repliesByComment[comment.id] || []
  }));
}

function dbUnavailable(res, error) {
  console.error("Database error:", error);
  return sendJson(res, 500, {
    ok: false,
    error: "Database unavailable. Check MySQL is running and DB_HOST/DB_USER/DB_PASSWORD/DB_NAME are correct."
  });
}

async function handleApi(req, res, pathname) {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);

  try {
    if (segments[1] === "users" && req.method === "GET" && segments.length === 2) {
      const [users] = await db.query("SELECT email, fullName, password, bio, expertise, role, createdAt FROM users ORDER BY createdAt DESC");
      return sendJson(res, 200, { ok: true, users: users.map((user) => sanitizeUser(user, true)) });
    }

    if (segments[1] === "users" && segments[2] === "register" && req.method === "POST") {
      const body = await parseBody(req);
      const user = sanitizeUser({ ...body, role: "user" }, true);
      if (!user.fullName || !user.email || !user.password) {
        return sendJson(res, 400, { ok: false, error: "Name, email, and password are required" });
      }
      try {
        await db.query(
          "INSERT INTO users (email, fullName, password, bio, expertise, role, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [user.email, user.fullName, user.password, user.bio, user.expertise, user.role, Date.now()]
        );
      } catch (e) {
        if (e && e.code === "ER_DUP_ENTRY") return sendJson(res, 409, { ok: false, error: "User already exists" });
        throw e;
      }
      return sendJson(res, 201, { ok: true, user });
    }

    if (segments[1] === "users" && segments[2] === "login" && req.method === "POST") {
      const body = await parseBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const [users] = await db.query(
        "SELECT email, fullName, password, bio, expertise, role FROM users WHERE email = ? AND password = ? LIMIT 1",
        [email, password]
      );
      if (!users.length) return sendJson(res, 401, { ok: false, error: "Invalid login credentials" });
      return sendJson(res, 200, { ok: true, user: sanitizeUser(users[0], true) });
    }

    if (segments[1] === "users" && segments[3] === "role" && req.method === "PUT") {
      const email = String(segments[2] || "").toLowerCase();
      const body = await parseBody(req);
      const role = normalizeRole(body.role);
      const [result] = await db.query("UPDATE users SET role = ? WHERE email = ?", [role, email]);
      if (!result.affectedRows) return sendJson(res, 404, { ok: false, error: "User not found" });
      const [[user]] = await db.query("SELECT email, fullName, password, bio, expertise, role FROM users WHERE email = ?", [email]);
      return sendJson(res, 200, { ok: true, user: sanitizeUser(user, true) });
    }

    if (segments[1] === "posts" && req.method === "GET" && segments.length === 2) {
      const [posts] = await db.query("SELECT * FROM posts ORDER BY createdAt DESC");
      return sendJson(res, 200, { ok: true, posts });
    }

    if (segments[1] === "posts" && req.method === "GET" && segments.length === 3) {
      const [posts] = await db.query("SELECT * FROM posts WHERE id = ? LIMIT 1", [segments[2]]);
      return posts.length ? sendJson(res, 200, { ok: true, post: posts[0] }) : sendJson(res, 404, { ok: false, error: "Post not found" });
    }

    if (segments[1] === "posts" && req.method === "POST" && segments.length === 2) {
      const post = await parseBody(req);
      if (!post || !post.id || !post.title || !post.content) {
        return sendJson(res, 400, { ok: false, error: "Post id, title, and content are required" });
      }
      const nextPost = {
        id: String(post.id),
        title: String(post.title),
        category: String(post.category || "General"),
        content: String(post.content),
        excerpt: String(post.excerpt || ""),
        coverImage: String(post.coverImage || ""),
        videoUrl: String(post.videoUrl || ""),
        youtubeUrl: String(post.youtubeUrl || ""),
        author: String(post.author || "Anonymous"),
        authorEmail: String(post.authorEmail || ""),
        authorBio: String(post.authorBio || ""),
        expertise: String(post.expertise || ""),
        date: String(post.date || ""),
        status: String(post.status || "published") === "draft" ? "draft" : "published",
        createdAt: Number(post.createdAt || Date.now()),
        likes: Number(post.likes || 0)
      };
      await db.query(
        `INSERT INTO posts
          (id, title, category, content, excerpt, coverImage, videoUrl, youtubeUrl, author, authorEmail, authorBio, expertise, date, status, createdAt, likes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          title = VALUES(title), category = VALUES(category), content = VALUES(content), excerpt = VALUES(excerpt),
          coverImage = VALUES(coverImage), videoUrl = VALUES(videoUrl), youtubeUrl = VALUES(youtubeUrl),
          author = VALUES(author), authorEmail = VALUES(authorEmail), authorBio = VALUES(authorBio),
          expertise = VALUES(expertise), date = VALUES(date), status = VALUES(status), createdAt = VALUES(createdAt), likes = VALUES(likes)`,
        [
          nextPost.id, nextPost.title, nextPost.category, nextPost.content, nextPost.excerpt, nextPost.coverImage,
          nextPost.videoUrl, nextPost.youtubeUrl, nextPost.author, nextPost.authorEmail, nextPost.authorBio,
          nextPost.expertise, nextPost.date, nextPost.status, nextPost.createdAt, nextPost.likes
        ]
      );
      return sendJson(res, 201, { ok: true, post: nextPost });
    }

    if (segments[1] === "posts" && req.method === "DELETE" && segments.length === 3) {
      const id = String(segments[2]);
      const [comments] = await db.query("SELECT id FROM comments WHERE postId = ?", [id]);
      const commentIds = comments.map((comment) => comment.id);
      if (commentIds.length) await db.query("DELETE FROM replies WHERE commentId IN (?)", [commentIds]);
      await db.query("DELETE FROM comments WHERE postId = ?", [id]);
      await db.query("DELETE FROM likes WHERE postId = ?", [id]);
      await db.query("DELETE FROM saved_posts WHERE postId = ?", [id]);
      await db.query("DELETE FROM reports WHERE postId = ?", [id]);
      await db.query("DELETE FROM analytics WHERE postId = ?", [id]);
      await db.query("DELETE FROM posts WHERE id = ?", [id]);
      return sendJson(res, 200, { ok: true, id });
    }

    if (segments[1] === "comments" && segments[3] === "replies" && req.method === "POST") {
      const commentId = String(segments[2]);
      const reply = await parseBody(req);
      if (!reply || !reply.text) return sendJson(res, 400, { ok: false, error: "Reply text is required" });
      const [[existing]] = await db.query("SELECT id FROM comments WHERE id = ? LIMIT 1", [commentId]);
      if (!existing) return sendJson(res, 404, { ok: false, error: "Comment not found" });
      const nextReply = {
        id: String(reply.id || Date.now()),
        commentId,
        name: String(reply.name || "Guest reader"),
        text: String(reply.text),
        date: String(reply.date || "")
      };
      await db.query(
        "INSERT IGNORE INTO replies (id, commentId, name, text, date) VALUES (?, ?, ?, ?, ?)",
        [nextReply.id, nextReply.commentId, nextReply.name, nextReply.text, nextReply.date]
      );
      return sendJson(res, 201, { ok: true, reply: nextReply });
    }

    if (segments[1] === "comments" && req.method === "GET" && segments.length === 3) {
      const comments = await getCommentsWithReplies(String(segments[2]));
      return sendJson(res, 200, { ok: true, comments, count: comments.length });
    }

    if (segments[1] === "comments" && req.method === "POST" && segments.length === 3) {
      const body = await parseBody(req);
      if (!body || !body.comment) return sendJson(res, 400, { ok: false, error: "Comment text is required" });
      const comment = {
        id: String(body.id || Date.now()),
        postId: String(segments[2]),
        name: String(body.name || "Guest reader"),
        email: String(body.email || ""),
        comment: String(body.comment),
        date: String(body.date || "")
      };
      await db.query(
        "INSERT IGNORE INTO comments (id, postId, name, email, comment, date) VALUES (?, ?, ?, ?, ?, ?)",
        [comment.id, comment.postId, comment.name, comment.email, comment.comment, comment.date]
      );
      const comments = await getCommentsWithReplies(comment.postId);
      return sendJson(res, 201, { ok: true, comment, comments, count: comments.length });
    }

    if (segments[1] === "likes" && req.method === "GET" && segments.length === 3) {
      const [actors] = await db.query("SELECT actorId FROM likes WHERE postId = ? ORDER BY actorId ASC", [segments[2]]);
      const ids = actors.map((row) => row.actorId);
      return sendJson(res, 200, { ok: true, postId: segments[2], actors: ids, count: ids.length });
    }

    if (segments[1] === "likes" && req.method === "POST" && segments.length === 2) {
      const body = await parseBody(req);
      const postId = String(body.postId || "").trim();
      const actorId = String(body.actorId || "").trim();
      if (!postId || !actorId) return sendJson(res, 400, { ok: false, error: "postId and actorId are required" });

      const [[existing]] = await db.query("SELECT postId FROM likes WHERE postId = ? AND actorId = ? LIMIT 1", [postId, actorId]);
      const liked = !existing;
      if (liked) await db.query("INSERT INTO likes (postId, actorId) VALUES (?, ?)", [postId, actorId]);
      else await db.query("DELETE FROM likes WHERE postId = ? AND actorId = ?", [postId, actorId]);

      const [actors] = await db.query("SELECT actorId FROM likes WHERE postId = ? ORDER BY actorId ASC", [postId]);
      const ids = actors.map((row) => row.actorId);
      await db.query("UPDATE posts SET likes = ? WHERE id = ?", [ids.length, postId]);
      return sendJson(res, 200, { ok: true, postId, actorId, liked, actors: ids, count: ids.length });
    }

    if (segments[1] === "saved" && req.method === "GET" && segments.length === 3) {
      const userKey = String(segments[2]);
      const [rows] = await db.query("SELECT postId FROM saved_posts WHERE userKey = ? ORDER BY postId ASC", [userKey]);
      return sendJson(res, 200, { ok: true, userKey, postIds: rows.map((row) => row.postId) });
    }

    if (segments[1] === "saved" && req.method === "POST" && segments.length === 2) {
      const body = await parseBody(req);
      const userKey = String(body.userKey || "").trim();
      const postId = String(body.postId || "").trim();
      if (!userKey || !postId) return sendJson(res, 400, { ok: false, error: "userKey and postId are required" });

      const [[existing]] = await db.query("SELECT userKey FROM saved_posts WHERE userKey = ? AND postId = ? LIMIT 1", [userKey, postId]);
      const saved = !existing;
      if (saved) await db.query("INSERT INTO saved_posts (userKey, postId) VALUES (?, ?)", [userKey, postId]);
      else await db.query("DELETE FROM saved_posts WHERE userKey = ? AND postId = ?", [userKey, postId]);

      const [rows] = await db.query("SELECT postId FROM saved_posts WHERE userKey = ? ORDER BY postId ASC", [userKey]);
      return sendJson(res, 200, { ok: true, userKey, postIds: rows.map((row) => row.postId), saved });
    }

    if (segments[1] === "reports" && req.method === "GET" && segments.length === 2) {
      const [reports] = await db.query("SELECT id, postId, reason, note, date FROM reports ORDER BY id DESC");
      return sendJson(res, 200, { ok: true, reports });
    }

    if (segments[1] === "reports" && req.method === "POST" && segments.length === 2) {
      const report = await parseBody(req);
      if (!report || !report.postId || !report.reason) return sendJson(res, 400, { ok: false, error: "postId and reason are required" });
      const nextReport = {
        id: String(report.id || Date.now()),
        postId: String(report.postId),
        reason: String(report.reason),
        note: String(report.note || ""),
        date: String(report.date || "")
      };
      await db.query(
        "INSERT IGNORE INTO reports (id, postId, reason, note, date) VALUES (?, ?, ?, ?, ?)",
        [nextReport.id, nextReport.postId, nextReport.reason, nextReport.note, nextReport.date]
      );
      return sendJson(res, 201, { ok: true, report: nextReport });
    }

    if (segments[1] === "reports" && req.method === "DELETE" && segments.length === 3) {
      await db.query("DELETE FROM reports WHERE id = ?", [segments[2]]);
      return sendJson(res, 200, { ok: true, id: segments[2] });
    }

    if (segments[1] === "contact" && req.method === "GET" && segments.length === 2) {
      const [messages] = await db.query("SELECT id, name, email, message, date FROM contact_messages ORDER BY id DESC");
      return sendJson(res, 200, { ok: true, messages });
    }

    if (segments[1] === "contact" && req.method === "POST" && segments.length === 2) {
      const msg = await parseBody(req);
      if (!msg || !msg.name || !msg.email || !msg.message) {
        return sendJson(res, 400, { ok: false, error: "name, email, and message are required" });
      }
      const nextMessage = {
        id: String(msg.id || Date.now()),
        name: String(msg.name),
        email: String(msg.email),
        message: String(msg.message),
        date: String(msg.date || "")
      };
      await db.query(
        "INSERT IGNORE INTO contact_messages (id, name, email, message, date) VALUES (?, ?, ?, ?, ?)",
        [nextMessage.id, nextMessage.name, nextMessage.email, nextMessage.message, nextMessage.date]
      );
      return sendJson(res, 201, { ok: true, message: nextMessage });
    }

    if (segments[1] === "analytics" && req.method === "GET" && segments.length === 3) {
      const [[row]] = await db.query("SELECT views FROM analytics WHERE postId = ? LIMIT 1", [segments[2]]);
      return sendJson(res, 200, { ok: true, postId: segments[2], views: row ? Number(row.views || 0) : 0 });
    }

    if (segments[1] === "analytics" && req.method === "POST" && segments.length === 3) {
      const postId = String(segments[2]);
      await db.query(
        "INSERT INTO analytics (postId, views) VALUES (?, 1) ON DUPLICATE KEY UPDATE views = views + 1",
        [postId]
      );
      const [[row]] = await db.query("SELECT views FROM analytics WHERE postId = ? LIMIT 1", [postId]);
      return sendJson(res, 200, { ok: true, postId, views: Number(row.views || 0) });
    }

    if (segments[1] === "drafts" && req.method === "GET" && segments.length === 3) {
      const email = String(segments[2]).toLowerCase();
      const [rows] = await db.query("SELECT title, category, content, coverImage, videoUrl, youtubeUrl, status, lastUpdated FROM drafts WHERE userEmail = ? LIMIT 1", [email]);
      return sendJson(res, 200, { ok: true, email, draft: rows[0] || null });
    }

    if (segments[1] === "drafts" && req.method === "PUT" && segments.length === 3) {
      const email = String(segments[2]).toLowerCase();
      const draft = await parseBody(req);
      const nextDraft = {
        title: String(draft.title || ""),
        category: String(draft.category || ""),
        content: String(draft.content || ""),
        coverImage: String(draft.coverImage || ""),
        videoUrl: String(draft.videoUrl || ""),
        youtubeUrl: String(draft.youtubeUrl || ""),
        status: String(draft.status || "draft"),
        lastUpdated: String(draft.lastUpdated || "")
      };
      await db.query(
        `INSERT INTO drafts (userEmail, title, category, content, coverImage, videoUrl, youtubeUrl, status, lastUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          title = VALUES(title), category = VALUES(category), content = VALUES(content), coverImage = VALUES(coverImage),
          videoUrl = VALUES(videoUrl), youtubeUrl = VALUES(youtubeUrl), status = VALUES(status), lastUpdated = VALUES(lastUpdated)`,
        [email, nextDraft.title, nextDraft.category, nextDraft.content, nextDraft.coverImage, nextDraft.videoUrl, nextDraft.youtubeUrl, nextDraft.status, nextDraft.lastUpdated]
      );
      return sendJson(res, 200, { ok: true, email, draft: nextDraft });
    }

    if (segments[1] === "followers" && req.method === "GET" && segments.length === 3) {
      const email = String(segments[2]).toLowerCase();
      const [rows] = await db.query("SELECT followerEmail FROM followers WHERE authorEmail = ? ORDER BY followerEmail ASC", [email]);
      return sendJson(res, 200, { ok: true, email, followers: rows.map((row) => row.followerEmail), count: rows.length });
    }

    if (segments[1] === "followers" && req.method === "POST" && segments.length === 2) {
      const body = await parseBody(req);
      const authorEmail = String(body.authorEmail || "").trim().toLowerCase();
      const followerEmail = String(body.followerEmail || "").trim().toLowerCase();
      if (!authorEmail || !followerEmail) return sendJson(res, 400, { ok: false, error: "authorEmail and followerEmail are required" });

      const [[existing]] = await db.query("SELECT authorEmail FROM followers WHERE authorEmail = ? AND followerEmail = ? LIMIT 1", [authorEmail, followerEmail]);
      const following = !existing;
      if (following) await db.query("INSERT INTO followers (authorEmail, followerEmail) VALUES (?, ?)", [authorEmail, followerEmail]);
      else await db.query("DELETE FROM followers WHERE authorEmail = ? AND followerEmail = ?", [authorEmail, followerEmail]);

      const [rows] = await db.query("SELECT followerEmail FROM followers WHERE authorEmail = ? ORDER BY followerEmail ASC", [authorEmail]);
      return sendJson(res, 200, { ok: true, authorEmail, followers: rows.map((row) => row.followerEmail), following });
    }

    if (segments[1] === "store" && req.method === "GET" && segments.length === 2) {
      return sendJson(res, 410, { ok: false, error: "The JSON store endpoint was replaced by MySQL-backed typed API routes." });
    }

    return false;
  } catch (e) {
    if (e && (e.code || e.errno)) return dbUnavailable(res, e);
    return sendJson(res, 400, { ok: false, error: e.message || "Bad request" });
  }
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

async function start() {
  try {
    await ensureDatabase();
    server.listen(PORT, HOST, () => {
      console.log(`Blog project server running at http://${HOST}:${PORT}`);
      console.log(`Using MySQL database ${DB_CONFIG.database} at ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    });
  } catch (e) {
    console.error("Could not initialize MySQL database:", e.message);
    console.error("Start MySQL and set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME if needed.");
    process.exit(1);
  }
}

start();
