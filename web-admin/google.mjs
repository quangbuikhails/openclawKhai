// Đọc Google Sheets và Calendar bằng service account CHỈ ĐỌC (PLAN.md D47). Không có đường ghi; mọi lần ghi đi qua khai-mcp-google (server.mjs).
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/calendar.readonly";
const KEY_FILE = process.env.GOOGLE_RO_KEY_FILE ?? "/run/secrets/google-ro-sa.json";
const SPREADSHEET_ID = process.env.WEB_SPREADSHEET_ID ?? "";
const CALENDAR_ID = process.env.WEB_CALENDAR_ID ?? "";
const SHEET_TAB = "bieu";
const CACHE_MS = 15000;
const BACKOFF_MS = 30000;
const MAX_ROW = 1000;
const CAL_OWNER = "khai-pbs";

export const COLS = ["stt", "received_date", "doc_title", "doc_number", "issuer", "action_required", "owner", "due_date", "priority", "status", "note", "doc_link", "doc_deadline", "remind_date"];
const HEADERS = ["STT", "Ngày nhận", "Tên văn bản", "Số ký hiệu", "Cơ quan ban hành", "Nội dung cần xử lý", "Người phụ trách", "Hạn hoàn thành", "Ưu tiên", "Trạng thái", "Ghi chú", "Link tài liệu", "Thời hạn yêu cầu trong văn bản", "Ngày nhắc việc"];
const DATE_COLS = new Set(["received_date", "due_date", "doc_deadline", "remind_date"]);

export const googleReady = () => Boolean(SPREADSHEET_ID && CALENDAR_ID);
const serviceAccount = JSON.parse(readFileSync(KEY_FILE, "utf8"));

// ---- Token: JWT RS256 đổi lấy access token (giữ trong bộ nhớ) ----
const b64url = (s) => Buffer.from(s).toString("base64url");
let cached = { value: "", expiresAt: 0 };
async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cached.value && cached.expiresAt - 60 > now) return cached.value;
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: serviceAccount.client_email, scope: SCOPES, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(serviceAccount.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${sig}` }),
  });
  if (!res.ok) throw new GoogleError(res.status, "Google từ chối cấp token");
  const body = await res.json();
  cached = { value: body.access_token, expiresAt: now + Number(body.expires_in ?? 3600) };
  return cached.value;
}

class GoogleError extends Error {
  constructor(status, message, retryAfter = 0) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const stats = { rate_limited: 0, errors: 0 };

// Chỉ GET. 429/5xx: chờ Retry-After (tối đa 5 giây), đọc lại một lần.
async function googleGet(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` } });
    if (res.ok) return res.json();
    if (res.status === 429) stats.rate_limited++;
    const retriable = res.status === 429 || res.status >= 500;
    if (retriable && attempt === 0) {
      await sleep(Math.min(Number(res.headers.get("retry-after")) || 2, 5) * 1000);
      continue;
    }
    // Không đưa nội dung phản hồi (có thể chứa dữ liệu) vào lỗi.
    throw new GoogleError(res.status, `Google API lỗi HTTP ${res.status}`);
  }
}

// ---- Ngày: Asia/Ho_Chi_Minh (UTC+7); ngày trong Sheets là số serial ----
const DAY_MS = 86400000;
const SHEET_EPOCH = Date.UTC(1899, 11, 30);
export const todayIso = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const serialToIso = (n) => new Date(SHEET_EPOCH + Math.floor(n) * DAY_MS).toISOString().slice(0, 10);
const isBlank = (v) => v === undefined || v === null || v === "";

function toRecord(row, cells) {
  const rec = { row };
  COLS.forEach((c, i) => {
    const v = cells[i];
    if (isBlank(v)) rec[c] = null;
    else if (DATE_COLS.has(c) && typeof v === "number") rec[c] = serialToIso(v);
    else if (DATE_COLS.has(c)) rec[c] = null; // chuỗi lạ trong cột ngày: không đoán
    else rec[c] = typeof v === "string" ? v : String(v);
  });
  // Chỉ nhận link Drive; mọi thứ khác bỏ (chặn javascript:, http: lạ).
  if (rec.doc_link && !rec.doc_link.startsWith("https://drive.google.com/")) rec.doc_link = null;
  return rec;
}

const CLOSED = new Set(["Đã xong", "Hủy"]);
function flags(rec, today) {
  const open = !CLOSED.has(rec.status);
  const due = rec.due_date ?? rec.doc_deadline; // giống công thức cột N (PLAN.md mục 4)
  rec.open = open;
  rec.overdue = open && due !== null && due < today;
  rec.due_today = open && due === today;
  rec.remind_due = open && rec.remind_date !== null && today >= rec.remind_date;
  rec.urgent = open && (rec.overdue || rec.due_today || rec.remind_due);
  return rec;
}

async function loadTasks() {
  const sheet = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
  const q = "valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER";
  const url = (range) => `${sheet}/values/${encodeURIComponent(range)}?${q}`;
  const [head, body] = await Promise.all([googleGet(url(`${SHEET_TAB}!A1:N1`)), googleGet(url(`${SHEET_TAB}!A2:N${MAX_ROW}`))]);
  const h = head.values?.[0] ?? [];
  if (h.length !== HEADERS.length || HEADERS.some((x, i) => String(h[i]).trim() !== x)) {
    throw new GoogleError(0, `Tiêu đề trang ${SHEET_TAB} không khớp 14 cột của PLAN.md mục 4`);
  }
  const today = todayIso();
  const rows = (body.values ?? [])
    .map((cells, i) => ({ cells, row: i + 2 }))
    .filter(({ cells }) => cells.some((v) => !isBlank(v)))
    .map(({ cells, row }) => flags(toRecord(row, cells), today));
  const open = rows.filter((r) => r.open);
  const counts = {
    all: rows.length,
    open: open.length,
    urgent: rows.filter((r) => r.urgent).length,
    overdue: rows.filter((r) => r.overdue).length,
    due_today: rows.filter((r) => r.due_today).length,
    remind_due: rows.filter((r) => r.remind_due).length,
    done: rows.filter((r) => r.status === "Đã xong").length,
  };
  return { today, rows, counts, spreadsheet_url: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit` };
}

// ---- Đệm 15 giây, gộp các yêu cầu đồng thời, lỗi thì trả bản cũ (stale) ----
function makeCache(loader) {
  let snap = null; // {at, data}
  let inflight = null;
  let blockedUntil = 0;
  const get = async () => {
    const now = Date.now();
    if (snap && now - snap.at < CACHE_MS) return { ...snap, stale: false };
    if (snap && now < blockedUntil) return { ...snap, stale: true };
    inflight ??= loader()
      .then((data) => {
        snap = { at: Date.now(), data };
        blockedUntil = 0;
      })
      .catch((e) => {
        stats.errors++;
        blockedUntil = Date.now() + BACKOFF_MS;
        if (!snap) throw e;
        console.error(`google: lỗi ${e.status ?? ""} ${e.message}; dùng dữ liệu cũ`);
      })
      .finally(() => {
        inflight = null;
      });
    await inflight;
    const fresh = snap && snap.at >= now;
    return { ...snap, stale: !fresh };
  };
  // Sau khi ghi qua khai-mcp-google: lần đọc kế tiếp phải hỏi lại Google, không dùng bản đệm.
  get.invalidate = () => {
    snap = null;
    blockedUntil = 0;
  };
  return get;
}

export const getTasks = makeCache(loadTasks);

// ---- Nhật ký (D49): dòng log của trợ lý và web (sửa tay không có log). Giờ trong log là serial giờ Việt Nam. ----
const LOG_CHANNELS = new Set(["ui", "zalo", "telegram", "web"]);
const serialToLocal = (n) => new Date(Math.round((n - 25569) * DAY_MS)).toISOString().slice(0, 16);
async function loadLog() {
  const range = encodeURIComponent("log!A2:E5000");
  const data = await googleGet(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`);
  const entries = (data.values ?? [])
    .filter((r) => typeof r[0] === "number" && LOG_CHANNELS.has(r[1]))
    .map((r) => ({ time: serialToLocal(r[0]), channel: r[1], action: String(r[2] ?? ""), stt: typeof r[3] === "number" ? r[3] : null, summary: String(r[4] ?? "").slice(0, 120) }));
  return { entries: entries.slice(-30).reverse() };
}
export const getLog = makeCache(loadLog);
// Sau khi ghi qua khai-mcp-google: bỏ đệm biểu và log để lần đọc kế tiếp thấy thay đổi.
export const invalidateAfterWrite = () => {
  getTasks.invalidate();
  getLog.invalidate();
};

// ---- Lịch: chỉ tiêu đề và giờ (D25, D47) ----
const EVENT_FIELDS = "items(id,summary,status,start,end,extendedProperties/private(owner,kind))";
const SYNC_KINDS = new Set(["nhac", "han"]);
const isSyncKind = (e) => e.extendedProperties?.private?.owner === CAL_OWNER && SYNC_KINDS.has(e.extendedProperties.private.kind);
const eventCaches = new Map();
export function getEvents(fromIso, toIso) {
  const key = `${fromIso}|${toIso}`;
  if (!eventCaches.has(key)) {
    if (eventCaches.size >= 8) eventCaches.delete(eventCaches.keys().next().value);
    eventCaches.set(
      key,
      makeCache(async () => {
        const p = new URLSearchParams({
          timeMin: `${fromIso}T00:00:00+07:00`,
          timeMax: `${toIso}T23:59:59+07:00`,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "250",
          fields: EVENT_FIELDS,
        });
        const data = await googleGet(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${p}`);
        return {
          events: (data.items ?? [])
            .filter((e) => e.status !== "cancelled")
            .map((e) => ({
              id: e.id,
              summary: e.summary ?? "",
              start: e.start?.date ?? e.start?.dateTime ?? null,
              end: e.end?.date ?? e.end?.dateTime ?? null,
              by_assistant: e.extendedProperties?.private?.owner === CAL_OWNER,
              // [Nhắc]/[Hạn] do server khai-mcp-google đồng bộ từ biểu (D28): có owner và kind nhac|han. Còn lại là lịch hẹn.
              kind: isSyncKind(e) ? e.extendedProperties.private.kind : null,
            })),
        };
      }),
    );
  }
  return eventCaches.get(key)();
}
