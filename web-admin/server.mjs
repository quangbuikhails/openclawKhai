// Máy chủ web chỉ đọc cho Biểu theo dõi (G4-02, PLAN.md D47). Không có đường ghi lên Google.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { authReady, checkPassword, makeSession, validSession, recordLogin, lockRemaining, COOKIE, SESSION_HOURS } from "./auth.mjs";
import { getTasks, getEvents, googleReady, todayIso, stats } from "./google.mjs";

const PORT = Number(process.env.PORT ?? 3000);
if (!authReady() || !googleReady()) {
  console.error("web-admin: thiếu WEB_PASSWORD_HASH, SESSION_SECRET, WEB_SPREADSHEET_ID hoặc WEB_CALENDAR_ID (chạy scripts/web-admin-khoi-tao.mjs)");
  process.exit(1);
}

// Tệp tĩnh: danh sách trắng, đọc một lần vào bộ nhớ.
const TYPES = { html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8" };
const STATIC = {};
for (const [url, file] of [["/", "index.html"], ["/lich", "lich.html"], ["/login", "login.html"], ["/app.js", "app.js"], ["/lich.js", "lich.js"], ["/shared.js", "shared.js"], ["/login.js", "login.js"], ["/style.css", "style.css"]]) {
  const body = readFileSync(fileURLToPath(new URL(`./public/${file}`, import.meta.url)));
  STATIC[url] = { body, type: TYPES[file.split(".").pop()], etag: `"${createHash("sha256").update(body).digest("base64url").slice(0, 22)}"` };
}

const SECURITY = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { ...SECURITY, ...headers });
  res.end(body);
};
// Tệp tĩnh: no-cache (trình duyệt luôn hỏi lại) kèm ETag; nội dung không đổi thì trả 304 để không tải lại.
const sendStatic = (req, res, f) => {
  const headers = { "Content-Type": f.type, "Cache-Control": "no-cache", ETag: f.etag };
  if (req.headers["if-none-match"] === f.etag) return send(res, 304, "", headers);
  return send(res, 200, f.body, headers);
};
const json = (res, status, obj, headers = {}) => send(res, status, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });

const isHttps = (req) => req.headers["x-forwarded-proto"] === "https";
const cookie = (req, value, maxAge) => `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${isHttps(req) ? "; Secure" : ""}`;

function readBody(req, limit = 2048) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("quá lớn"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const originOk = (req) => {
  const o = req.headers.origin;
  if (!o) return false;
  try {
    return new URL(o).host === req.headers.host;
  } catch {
    return false;
  }
};

const isoOk = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s ?? "")) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
};

async function handle(req, res, url) {
  const path = url.pathname;
  const method = req.method;

  if (path === "/healthz" && (method === "GET" || method === "HEAD")) return json(res, 200, { ok: true });

  if (path === "/api/login" && method === "POST") {
    if (!originOk(req)) return json(res, 403, { error: "origin" });
    const wait = lockRemaining();
    if (wait > 0) return json(res, 429, { error: "Thử lại sau", retry_after: wait }, { "Retry-After": String(wait) });
    let password;
    try {
      password = JSON.parse(await readBody(req)).password;
    } catch {
      return json(res, 400, { error: "yêu cầu không hợp lệ" });
    }
    const ok = checkPassword(password);
    recordLogin(ok);
    if (!ok) return json(res, 401, { error: "Sai mật khẩu" });
    return json(res, 200, { ok: true }, { "Set-Cookie": cookie(req, makeSession(), SESSION_HOURS * 3600) });
  }

  if (path === "/api/logout" && method === "POST") {
    if (!originOk(req)) return json(res, 403, { error: "origin" });
    return json(res, 200, { ok: true }, { "Set-Cookie": cookie(req, "", 0) });
  }

  if (method !== "GET" && method !== "HEAD") return json(res, 405, { error: "Chỉ đọc" }, { Allow: "GET, HEAD" });

  if (path === "/login" || path === "/login.js" || path === "/style.css") {
    return sendStatic(req, res, STATIC[path]);
  }

  const authed = validSession(req.headers.cookie);

  if (path === "/" || path === "/lich" || path === "/app.js" || path === "/lich.js" || path === "/shared.js") {
    if (!authed) return path === "/" || path === "/lich" ? send(res, 302, "", { Location: "/login" }) : send(res, 401, "");
    return sendStatic(req, res, STATIC[path]);
  }

  if (path === "/api/tasks" || path === "/api/events") {
    if (!authed) return json(res, 401, { error: "Chưa đăng nhập" });
    let snap;
    try {
      if (path === "/api/tasks") snap = await getTasks();
      else {
        const from = url.searchParams.get("from") ?? todayIso();
        const to = url.searchParams.get("to") ?? from;
        if (!isoOk(from) || !isoOk(to) || to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 62) {
          return json(res, 400, { error: "from, to dạng yyyy-mm-dd, to ≥ from, tối đa 62 ngày" });
        }
        snap = await getEvents(from, to);
      }
    } catch (e) {
      console.error(`google: ${e.status ?? ""} ${e.message}`);
      return json(res, 502, { error: e.status === 0 ? e.message : "Chưa đọc được Google, thử lại sau" });
    }
    return json(res, 200, { fetched_at: new Date(snap.at).toISOString(), stale: snap.stale, ...snap.data });
  }

  return json(res, 404, { error: "Không có" });
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const t = Date.now();
  res.on("finish", () => {
    if (url.pathname !== "/healthz") console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - t}ms`);
  });
  handle(req, res, url).catch((e) => {
    console.error(`lỗi: ${e.message}`);
    if (!res.headersSent) json(res, 500, { error: "Lỗi máy chủ" });
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log(`web-admin: nghe cổng ${PORT} (chỉ đọc)`);
  setInterval(() => stats.rate_limited && console.log(`google 429 đến nay: ${stats.rate_limited}`), 3600000).unref();
});
