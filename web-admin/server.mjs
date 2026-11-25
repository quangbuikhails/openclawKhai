// Máy chủ web cho Biểu theo dõi, Lịch, Kanban (PLAN.md D47). Đọc Google bằng khóa chỉ đọc; không có đường ghi lên Google.
// Đường ghi duy nhất (G4-03): POST /api/task-status chuyển sang khai-mcp-google /web/task-status bằng WEB_TOKEN.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { authReady, checkPassword, makeSession, validSession, recordLogin, lockRemaining, COOKIE, SESSION_HOURS } from "./auth.mjs";
import { getTasks, getEvents, getLog, invalidateAfterWrite, googleReady, todayIso, stats } from "./google.mjs";

const PORT = Number(process.env.PORT ?? 3000);
// Ghi trạng thái (Kanban): cần đủ WEB_TOKEN và WEB_ORIGIN (khớp WEB_ORIGIN của khai-mcp-google); thiếu thì chỉ đọc.
const WEB_TOKEN = /^[\x21-\x7e]{32,}$/.test(process.env.WEB_TOKEN ?? "") ? process.env.WEB_TOKEN : "";
const WEB_ORIGIN = /^https?:\/\/[^/\s]+$/.test(process.env.WEB_ORIGIN ?? "") ? process.env.WEB_ORIGIN : "";
const MCP_WRITE_URL = process.env.MCP_WRITE_URL ?? "http://khai-mcp-google:3000";
const WRITE_ENABLED = Boolean(WEB_TOKEN && WEB_ORIGIN);
const KANBAN = ["Chưa xử lý", "Đang xử lý", "Chờ ý kiến", "Đã xong"];
if (!authReady() || !googleReady()) {
  console.error("web-admin: thiếu WEB_PASSWORD_HASH, SESSION_SECRET, WEB_SPREADSHEET_ID hoặc WEB_CALENDAR_ID (chạy scripts/web-admin-khoi-tao.mjs)");
  process.exit(1);
}

// Tệp tĩnh: danh sách trắng, đọc một lần vào bộ nhớ.
const TYPES = { html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8" };
const STATIC = {};
for (const [url, file] of [["/", "index.html"], ["/lich", "lich.html"], ["/kanban", "kanban.html"], ["/login", "login.html"], ["/app.js", "app.js"], ["/lich.js", "lich.js"], ["/kanban.js", "kanban.js"], ["/shared.js", "shared.js"], ["/login.js", "login.js"], ["/style.css", "style.css"]]) {
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

// Giới hạn ghi: tối đa 30 lần mỗi phút (toàn cục; web chỉ có một người dùng).
const writeTimes = [];
const writeAllowed = () => {
  const now = Date.now();
  while (writeTimes.length && now - writeTimes[0] > 60000) writeTimes.shift();
  if (writeTimes.length >= 30) return false;
  writeTimes.push(now);
  return true;
};

// Chỉ nhận đúng {stt, from, to}; from, to thuộc bốn cột Kanban và khác nhau (không Hủy).
function parseMove(text) {
  let b;
  try {
    b = JSON.parse(text);
  } catch {
    return null;
  }
  if (!b || typeof b !== "object" || Array.isArray(b) || Object.keys(b).sort().join() !== "from,stt,to") return null;
  if (!Number.isInteger(b.stt) || b.stt < 1 || b.stt > 100000) return null;
  if (!KANBAN.includes(b.from) || !KANBAN.includes(b.to) || b.from === b.to) return null;
  return { stt: b.stt, from: b.from, to: b.to };
}

async function moveTask(res, move) {
  let r;
  try {
    r = await fetch(`${MCP_WRITE_URL}/web/task-status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WEB_TOKEN}`, Origin: WEB_ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify(move),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return json(res, 502, { error: "Chưa nối được máy chủ ghi, thử lại sau" });
  }
  let body = {};
  try {
    body = await r.json();
  } catch {}
  if (r.status === 200) {
    invalidateAfterWrite();
    // Chỉ chuyển tiếp các trường đã biết, không chuyển nguyên phản hồi.
    const cs = body.calendar_sync;
    const num = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
    const calendar = cs === "failed" ? "failed" : cs && typeof cs === "object" ? { created: num(cs.created), moved: num(cs.moved), deleted: num(cs.deleted) } : null;
    return json(res, 200, { ok: true, status: move.to, unchanged: body.unchanged === true, calendar, log_warning: Boolean(body.log_warning) });
  }
  if (r.status === 409) {
    invalidateAfterWrite();
    return json(res, 409, { error: "Việc vừa được đổi ở nơi khác", current: typeof body.current === "string" ? body.current : null });
  }
  if (r.status === 404) return json(res, 404, { error: "Không thấy việc này trên biểu" });
  if (r.status === 403) return json(res, 403, { error: "Việc này không được đổi từ web" });
  return json(res, 502, { error: "Chưa ghi được, thử lại sau" });
}

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

  // Ghi (G4-03): Origin trước, rồi phiên, rồi dữ liệu. Không có đường ghi nào khác.
  if (path === "/api/task-status" && method === "POST") {
    if (!originOk(req)) return json(res, 403, { error: "origin" });
    if (!validSession(req.headers.cookie)) return json(res, 401, { error: "Chưa đăng nhập" });
    if (!WRITE_ENABLED) return json(res, 503, { error: "Chưa bật ghi từ web" });
    let text;
    try {
      text = await readBody(req);
    } catch {
      return json(res, 400, { error: "yêu cầu không hợp lệ" });
    }
    const move = parseMove(text);
    if (!move) return json(res, 400, { error: "yêu cầu không hợp lệ" });
    if (!writeAllowed()) return json(res, 429, { error: "Thao tác quá nhanh, thử lại sau", retry_after: 10 }, { "Retry-After": "10" });
    return moveTask(res, move);
  }

  if (method !== "GET" && method !== "HEAD") return json(res, 405, { error: "Chỉ đọc" }, { Allow: "GET, HEAD" });

  if (path === "/login" || path === "/login.js" || path === "/style.css") {
    return sendStatic(req, res, STATIC[path]);
  }

  const authed = validSession(req.headers.cookie);

  if (path === "/" || path === "/lich" || path === "/kanban" || path === "/app.js" || path === "/lich.js" || path === "/kanban.js" || path === "/shared.js") {
    if (!authed) return path === "/" || path === "/lich" || path === "/kanban" ? send(res, 302, "", { Location: "/login" }) : send(res, 401, "");
    return sendStatic(req, res, STATIC[path]);
  }

  if (path === "/api/tasks" || path === "/api/events" || path === "/api/log") {
    if (!authed) return json(res, 401, { error: "Chưa đăng nhập" });
    let snap;
    try {
      if (path === "/api/tasks") snap = await getTasks();
      else if (path === "/api/log") snap = await getLog();
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
    return json(res, 200, { fetched_at: new Date(snap.at).toISOString(), stale: snap.stale, ...(path === "/api/tasks" ? { can_write: WRITE_ENABLED } : {}), ...snap.data });
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
  console.log(`web-admin: nghe cổng ${PORT} (ghi trạng thái: ${WRITE_ENABLED ? "bật" : "tắt"})`);
  setInterval(() => stats.rate_limited && console.log(`google 429 đến nay: ${stats.rate_limited}`), 3600000).unref();
});
