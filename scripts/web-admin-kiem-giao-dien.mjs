// Kiểm giao diện web-admin ngoại tuyến, không thêm package (G4-04 sửa lỗi).
// Chạy: docker run --rm --network none --entrypoint node -v "$PWD:/r:ro" "$OPENCLAW_IMAGE" /r/scripts/web-admin-kiem-giao-dien.mjs
// 1) Mọi tên được import từ module nội bộ đều có export. 2) Không nạp tài nguyên ngoài (CSP default-src 'self').
// 3) Nạp app.js và lich.js như ES module với DOM giả tối thiểu, chạy hết bước vẽ.
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "web-admin", "public");
const files = readdirSync(PUBLIC);
let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "ĐẠT " : "LỖI "} ${msg}`);
  if (!ok) failed++;
};

// ---- 1) import/export ----
const exportsOf = (src) => {
  const names = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) m[1].split(",").forEach((x) => names.add(x.trim().split(/\s+as\s+/).pop()));
  return names;
};
for (const f of files.filter((x) => x.endsWith(".js"))) {
  const src = readFileSync(join(PUBLIC, f), "utf8");
  for (const m of src.matchAll(/^import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/gm)) {
    const target = m[2].replace(/^\//, "");
    if (!files.includes(target)) { check(false, `${f}: import từ ${m[2]} không có tệp`); continue; }
    const have = exportsOf(readFileSync(join(PUBLIC, target), "utf8"));
    for (const name of m[1].split(",").map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) check(have.has(name), `${f} import ${name} từ ${m[2]}`);
  }
}

// ---- 2) không tài nguyên ngoài ----
for (const f of files.filter((x) => /\.(html|css)$/.test(x))) {
  const src = readFileSync(join(PUBLIC, f), "utf8");
  const ext = [...src.matchAll(/(?:href|src)\s*=\s*["']?(?:https?:)?\/\/[^"'\s>]+|@import[^;]+|url\(\s*["']?(?:https?:)?\/\/[^)]+/gi)].map((m) => m[0]);
  check(ext.length === 0, `${f}: không nạp tài nguyên ngoài${ext.length ? ` (${ext.join("; ")})` : ""}`);
}

// ---- 3) DOM giả ----
class Node_ {
  constructor(tag = "#text") { this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.className = ""; this._text = ""; this.hidden = false; this.href = ""; this.value = ""; this.style = {}; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); }
  set textContent(v) { this._text = String(v); this.children = []; }
  append(...n) { this.children.push(...n.map((x) => (typeof x === "string" ? Object.assign(new Node_(), { _text: x }) : x))); }
  replaceChildren(...n) { this.children = []; this.append(...n); }
  addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = v; }
  closest() { return null; }
  scrollIntoView() {}
  get tHead() { return (this._head ??= new Node_("thead")); }
  get tBodies() { return [(this._body ??= new Node_("tbody"))]; }
  get classList() { return { add() {}, remove() {}, toggle() {} }; }
}
const byId = new Map();
globalThis.document = {
  hidden: false,
  getElementById: (id) => { if (!byId.has(id)) byId.set(id, new Node_(`#${id}`)); return byId.get(id); },
  createElement: (t) => new Node_(t),
  createTextNode: (t) => Object.assign(new Node_(), { _text: String(t) }),
  createDocumentFragment: () => new Node_("#frag"),
  addEventListener() {},
};
globalThis.matchMedia = () => ({ matches: false });
globalThis.location = { replace() {} };
globalThis.setInterval = () => ({ unref() {} });
globalThis.clearInterval = () => {};
const now = new Date().toISOString();
const rec = (o) => ({ row: 2, stt: "1", received_date: null, doc_title: "Việc thử", doc_number: "12/TEST", issuer: null, action_required: "Làm", owner: null, due_date: null, priority: "Thường", status: "Chưa xử lý", note: null, doc_link: null, doc_deadline: null, remind_date: null, open: true, overdue: false, due_today: false, remind_due: false, urgent: false, ...o });
const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const tasks = {
  fetched_at: now, stale: false, today, spreadsheet_url: "https://docs.google.com/spreadsheets/d/x/edit",
  rows: [rec({ row: 2, stt: "1", due_date: today, remind_date: today, remind_due: true, due_today: true, urgent: true }), rec({ row: 3, stt: "2", due_date: today, doc_title: null, status: "Chờ ý kiến" })],
  counts: { all: 2, open: 2, urgent: 1, overdue: 0, due_today: 2, remind_due: 1, done: 0 },
};
const events = { fetched_at: now, stale: false, events: [{ id: "e1", summary: "Họp thử", start: `${today}T09:00:00+07:00`, end: `${today}T10:00:00+07:00`, by_assistant: false, kind: null }, { id: "e2", summary: "[Hạn] đồng bộ", start: today, end: today, by_assistant: true, kind: "han" }] };
globalThis.fetch = async (url) => {
  const body = String(url).startsWith("/api/tasks") ? tasks : String(url).startsWith("/api/events") ? events : null;
  if (!body) throw new Error(`fetch lạ: ${url}`);
  return { ok: true, status: 200, json: async () => body };
};

// Chép public/ sang thư mục tạm, đổi "/shared.js" thành "./shared.js" để Node phân giải; mọi thứ khác giữ nguyên.
const tmp = mkdtempSync(join(tmpdir(), "wa-ui-"));
try {
  for (const f of files.filter((x) => x.endsWith(".js"))) writeFileSync(join(tmp, f), readFileSync(join(PUBLIC, f), "utf8").replaceAll('from "/shared.js"', 'from "./shared.js"'));
  const settle = () => new Promise((r) => setTimeout(r, 50));

  try {
    await import(pathToFileURL(join(tmp, "app.js")));
    await settle();
    const q = (id) => document.getElementById(id);
    check(q("cards").children.length === 2, `app.js: vẽ ${q("cards").children.length}/2 thẻ`);
    check(q("table").tBodies[0].children.length === 2, "app.js: vẽ 2 hàng bảng");
    check(q("tiles").children.length === 4, "app.js: 4 thẻ tóm tắt");
    check(q("chips").children.length === 5, "app.js: 5 chip lọc");
    check(q("syncText").textContent !== "", "app.js: có dòng đồng bộ");
  } catch (e) { check(false, `app.js: ${e.message}`); }

  byId.clear();
  try {
    await import(pathToFileURL(join(tmp, "lich.js")));
    await settle();
    const q = (id) => document.getElementById(id);
    const cells = q("grid").children;
    check(cells.length === 7 + 42 || cells.length === 7 + 35 || cells.length === 7 + 28, `lich.js: màn tháng ${cells.length} ô (gồm 7 tên thứ)`);
    const text = q("grid").textContent;
    check(text.includes("Họp thử"), "lich.js: có lịch hẹn");
    check(!text.includes("đồng bộ"), "lich.js: không hiện lại [Hạn] có kind");
    check(text.includes("[Nhắc]") && text.includes("[Hạn]"), "lich.js: có mốc [Nhắc], [Hạn] từ biểu");
    check(q("upList").children.length >= 3, `lich.js: 7 ngày tới có ${q("upList").children.length} mục`);
  } catch (e) { check(false, `lich.js: ${e.message}`); }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? `${failed} phép kiểm LỖI` : "Tất cả đạt");
process.exit(failed ? 1 : 0);
