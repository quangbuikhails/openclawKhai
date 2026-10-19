// Server MCP Google tối thiểu cho spike G2-01B (PLAN.md D21).
// Chạy trong container riêng từ image OpenClaw (mount vào /app/mcp-google để dùng /app/node_modules).
// Chỉ thao tác đúng một bảng tính và một lịch, ID lấy từ biến môi trường; không công cụ nào nhận ID từ mô hình.
import { createServer } from "node:http";
import { createSign, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const TEST_PREFIX = "[TEST]";
const SHEET_TAB = "bieu";
const LAST_COL = "N"; // 14 cột theo PLAN.md mục 4
const MAX_BODY_BYTES = 64 * 1024;
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/calendar",
].join(" ");

function requireEnv(name, pattern) {
  const value = process.env[name] ?? "";
  if (!pattern.test(value)) {
    console.error(`Thiếu hoặc sai biến môi trường ${name}`);
    process.exit(1);
  }
  return value;
}

const MCP_TOKEN = requireEnv("MCP_GOOGLE_TOKEN", /^[\x21-\x7e]{32,}$/);
const SPREADSHEET_ID = requireEnv("TEST_SPREADSHEET_ID", /^[A-Za-z0-9_-]{20,}$/);
const CALENDAR_ID = requireEnv("TEST_CALENDAR_ID", /^[A-Za-z0-9_.@-]{5,}$/);
const PORT = Number(process.env.PORT ?? 3000);

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(process.env.GOOGLE_SA_FILE ?? "/run/secrets/google-sa.json", "utf8"));
} catch {
  console.error("Không đọc được khóa Service Account");
  process.exit(1);
}
if (!serviceAccount.client_email || !serviceAccount.private_key) {
  console.error("Khóa Service Account thiếu client_email hoặc private_key");
  process.exit(1);
}

// ---- Xác thực Google: JWT RS256 đổi lấy access token, lưu tạm trong bộ nhớ ----
const b64url = (input) => Buffer.from(input).toString("base64url");
let cachedToken = { value: "", expiresAt: 0 };

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken.value && cachedToken.expiresAt - 60 > now) return cachedToken.value;
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: SCOPES,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(serviceAccount.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Google từ chối cấp token (HTTP ${res.status})`);
  const body = await res.json();
  cachedToken = { value: body.access_token, expiresAt: now + Number(body.expires_in ?? 3600) };
  return cachedToken.value;
}

async function google(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    // Không đưa nội dung phản hồi (có thể chứa dữ liệu) vào lỗi.
    throw new Error(`Google API lỗi HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

const SHEETS = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
const CAL = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;

// ---- Kiểm tra đầu vào ----
const a1 = z.string().regex(/^[A-Z]{1,2}[0-9]{1,5}(:[A-Z]{1,2}[0-9]{1,5})?$/, "A1 không kèm tên trang, ví dụ A1:N20");
const rowNumber = z.number().int().min(2).max(10000); // dòng 1 là tiêu đề
const rowValues = z.array(z.string().max(2000)).min(1).max(14);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-mm-dd");
const eventId = z.string().regex(/^[a-v0-9]{5,1024}$/);
const title = z.string().min(1).max(200);

const addDay = (date) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(data) }] });
const fail = (message) => ({ isError: true, content: [{ type: "text", text: message }] });
const summarize = (e) => ({ id: e.id, summary: e.summary, start: e.start?.date ?? e.start?.dateTime, end: e.end?.date ?? e.end?.dateTime });

async function sheetGid() {
  const meta = await google("GET", `${SHEETS}?fields=sheets.properties(sheetId,title)`);
  const tab = meta.sheets?.find((s) => s.properties.title === SHEET_TAB);
  if (!tab) throw new Error(`Không thấy trang ${SHEET_TAB}`);
  return tab.properties.sheetId;
}

function buildServer() {
  const server = new McpServer({ name: "khai-mcp-google", version: "0.1.0" });

  // Mỗi công cụ ghi log tên và kết quả, không ghi nội dung dữ liệu.
  const tool = (name, description, inputSchema, handler) =>
    server.registerTool(name, { description, inputSchema }, async (args) => {
      try {
        const result = await handler(args);
        console.log(`tool=${name} ket_qua=${result.isError ? "tu_choi" : "ok"}`);
        return result;
      } catch (err) {
        console.log(`tool=${name} ket_qua=loi`);
        return fail(err.message);
      }
    });

  tool("sheet_read", `Đọc ô trên trang ${SHEET_TAB} của bảng tính thử.`, { range: a1 }, async ({ range }) => {
    const data = await google("GET", `${SHEETS}/values/${encodeURIComponent(`${SHEET_TAB}!${range}`)}`);
    return ok({ range: data.range, values: data.values ?? [] });
  });

  tool("sheet_append_row", "Thêm một dòng vào cuối trang bieu (ghi nguyên văn, không tính công thức).", { values: rowValues }, async ({ values }) => {
    const data = await google(
      "POST",
      `${SHEETS}/values/${encodeURIComponent(`${SHEET_TAB}!A:${LAST_COL}`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: [values] },
    );
    return ok({ updatedRange: data.updates?.updatedRange });
  });

  tool("sheet_update_row", "Ghi đè một dòng (từ dòng 2) của trang bieu.", { row: rowNumber, values: rowValues }, async ({ row, values }) => {
    const range = `${SHEET_TAB}!A${row}:${LAST_COL}${row}`;
    const data = await google("PUT", `${SHEETS}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, { values: [values] });
    return ok({ updatedRange: data.updatedRange });
  });

  // Luật [TEST] chỉ cho bảng thử. Gói 2 phải quyết luật xóa riêng cho bảng thật (ví dụ: xác nhận hai bước, hoặc chỉ đánh dấu hủy).
  tool("sheet_delete_row", `Xóa một dòng của trang bieu; chỉ khi ô cột A của dòng bắt đầu ${TEST_PREFIX}.`, { row: rowNumber }, async ({ row }) => {
    const cell = await google("GET", `${SHEETS}/values/${encodeURIComponent(`${SHEET_TAB}!A${row}`)}`);
    const first = cell.values?.[0]?.[0] ?? "";
    if (!first.startsWith(TEST_PREFIX)) return fail(`Từ chối: ô A${row} không bắt đầu bằng ${TEST_PREFIX}`);
    await google("POST", `${SHEETS}:batchUpdate`, {
      requests: [{ deleteDimension: { range: { sheetId: await sheetGid(), dimension: "ROWS", startIndex: row - 1, endIndex: row } } }],
    });
    return ok({ deletedRow: row });
  });

  tool(
    "cal_create_allday",
    "Tạo sự kiện cả ngày trên lịch thử; có thể đặt nhắc trước (phút).",
    { title, date: isoDate, reminder_minutes: z.number().int().min(0).max(40320).optional() },
    async ({ title: summary, date, reminder_minutes }) => {
      // Chỉ cho spike, Gói 2 quyết luật riêng.
      if (!summary.startsWith(TEST_PREFIX)) return fail(`Từ chối: tiêu đề không bắt đầu bằng ${TEST_PREFIX}`);
      const body = { summary, start: { date }, end: { date: addDay(date) } };
      if (reminder_minutes !== undefined) {
        body.reminders = { useDefault: false, overrides: [{ method: "popup", minutes: reminder_minutes }] };
      }
      return ok(summarize(await google("POST", CAL, body)));
    },
  );

  tool("cal_list", "Liệt kê sự kiện lịch thử trong khoảng ngày (tối đa 50).", { from: isoDate, to: isoDate }, async ({ from, to }) => {
    const q = new URLSearchParams({
      timeMin: `${from}T00:00:00+07:00`,
      timeMax: `${addDay(to)}T00:00:00+07:00`,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });
    const data = await google("GET", `${CAL}?${q}`);
    return ok((data.items ?? []).map(summarize));
  });

  tool(
    "cal_update",
    "Sửa tiêu đề hoặc ngày của sự kiện cả ngày trên lịch thử.",
    { event_id: eventId, title: title.optional(), date: isoDate.optional() },
    async ({ event_id, title: summary, date }) => {
      const body = {};
      if (summary !== undefined) body.summary = summary;
      if (date !== undefined) Object.assign(body, { start: { date }, end: { date: addDay(date) } });
      if (Object.keys(body).length === 0) return fail("Không có gì để sửa");
      return ok(summarize(await google("PATCH", `${CAL}/${event_id}`, body)));
    },
  );

  tool("cal_delete", `Xóa sự kiện trên lịch thử; chỉ khi tiêu đề bắt đầu ${TEST_PREFIX}.`, { event_id: eventId }, async ({ event_id }) => {
    const event = await google("GET", `${CAL}/${event_id}`);
    if (!(event.summary ?? "").startsWith(TEST_PREFIX)) return fail(`Từ chối: tiêu đề không bắt đầu bằng ${TEST_PREFIX}`);
    await google("DELETE", `${CAL}/${event_id}`);
    return ok({ deleted: event_id });
  });

  return server;
}

// ---- HTTP: một đường /mcp, Bearer token, không giữ phiên ----
function tokenMatches(header) {
  const given = Buffer.from((header ?? "").replace(/^Bearer /, ""));
  const expected = Buffer.from(MCP_TOKEN);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body quá lớn"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const send = (res, status, text) => {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" }).end(text);
};

createServer(async (req, res) => {
  const path = (req.url ?? "").split("?")[0];
  if (path === "/healthz" && req.method === "GET") return send(res, 200, "ok");
  if (path !== "/mcp") return send(res, 404, "not found");
  if (!tokenMatches(req.headers.authorization)) return send(res, 401, "unauthorized");
  if (req.method !== "POST") return send(res, 405, "method not allowed");
  try {
    const body = JSON.parse(await readBody(req));
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch {
    if (!res.headersSent) send(res, 400, "bad request");
  }
}).listen(PORT, "0.0.0.0", () => console.log(`khai-mcp-google lắng nghe cổng ${PORT}`));
