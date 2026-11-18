// Kiểm giao diện web-admin ngoại tuyến, không thêm package (G4-04 sửa lỗi).
// Chạy: docker run --rm --network none --entrypoint node -v "$PWD:/r:ro" "$OPENCLAW_IMAGE" /r/scripts/web-admin-kiem-giao-dien.mjs
// 1) Mọi tên được import từ module nội bộ đều có export. 2) Không nạp tài nguyên ngoài (CSP default-src 'self').
// 3) Nạp app.js, lich.js, kanban.js như ES module với DOM giả tối thiểu, chạy hết bước vẽ; Kanban: đổi cột, hoàn tác khi lỗi, 409, cùng cột.
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

// ---- 2b) liên kết điều hướng giữa ba trang; điện thoại không được ẩn thanh điều hướng ----
const PAGES = [["index.html", "/"], ["lich.html", "/lich"], ["kanban.html", "/kanban"]];
for (const [file, self] of PAGES) {
  const nav = readFileSync(join(PUBLIC, file), "utf8").match(/<nav>[\s\S]*?<\/nav>/)?.[0] ?? "";
  for (const [, other] of PAGES.filter(([f]) => f !== file)) check(nav.includes(`href="${other}"`), `${file}: có liên kết sang ${other}`);
  check(new RegExp(`class="nav-item active" href="${self}"`).test(nav), `${file}: mục đang mở được tô (active)`);
}
check(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(readFileSync(join(PUBLIC, "kanban.js"), "utf8").replace(/\/\/.*$/gm, "")), "kanban.js: không dùng innerHTML (văn bản từ Sheets gán bằng textContent)");
const phoneCss = readFileSync(join(PUBLIC, "style.css"), "utf8").match(/@media \(max-width: 767px\) \{[\s\S]*$/)?.[0] ?? "";
check(!/\.sidebar nav[^{]*\{[^}]*display:\s*none/.test(phoneCss), "style.css: khổ điện thoại không ẩn thanh điều hướng");
check(/\.sidebar nav\s*\{[^}]*display:\s*flex/.test(phoneCss), "style.css: khổ điện thoại hiện thanh điều hướng");

// ---- 3) DOM giả ----
class Node_ {
  constructor(tag = "#text") { this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.className = ""; this._text = ""; this.hidden = false; this.href = ""; this.value = ""; this.style = {}; this.dataset = {}; }
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
  querySelectorAll: () => [],
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
  can_write: true,
  rows: [rec({ row: 2, stt: "1", due_date: today, remind_date: today, remind_due: true, due_today: true, urgent: true }), rec({ row: 3, stt: "2", due_date: today, doc_title: null, status: "Chờ ý kiến" }), rec({ row: 4, stt: "3", status: "Hủy", open: false })],
  counts: { all: 2, open: 2, urgent: 1, overdue: 0, due_today: 2, remind_due: 1, done: 0 },
};
const events = { fetched_at: now, stale: false, events: [{ id: "e1", summary: "Họp thử", start: `${today}T09:00:00+07:00`, end: `${today}T10:00:00+07:00`, by_assistant: false, kind: null }, { id: "e2", summary: "[Hạn] đồng bộ", start: today, end: today, by_assistant: true, kind: "han" }] };
const logBody = { fetched_at: now, stale: false, entries: [{ time: "2026-11-18T14:05", channel: "web", action: "doi_trang_thai", stt: 2, summary: "Đang xử lý → Chờ ý kiến" }] };
const posts = []; // các yêu cầu ghi đã gửi
let postMode = "ok";
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (opts.method === "POST" && u === "/api/task-status") {
    posts.push(JSON.parse(opts.body));
    if (postMode === "net") throw new Error("mất mạng");
    if (postMode === "409") return { ok: false, status: 409, json: async () => ({ error: "đổi ở nơi khác", current: "Đang xử lý" }) };
    if (postMode === "502") return { ok: false, status: 502, json: async () => ({ error: "Chưa ghi được, thử lại sau" }) };
    return { ok: true, status: 200, json: async () => ({ ok: true, calendar: { created: 0, moved: 0, deleted: 1 }, log_warning: false }) };
  }
  const body = u.startsWith("/api/tasks") ? tasks : u.startsWith("/api/events") ? events : u.startsWith("/api/log") ? logBody : null;
  if (!body) throw new Error(`fetch lạ: ${u}`);
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

  byId.clear();
  try {
    const { shiftStatus, columnAt, KANBAN } = await import(pathToFileURL(join(tmp, "shared.js")));
    check(shiftStatus("Chưa xử lý", -1) === null && shiftStatus("Đã xong", 1) === null && shiftStatus("Đang xử lý", 1) === "Chờ ý kiến" && shiftStatus("Hủy", 1) === null, "shared.js: shiftStatus chặn mép và Hủy");
    check(columnAt([{ left: 0, right: 99 }, { left: 100, right: 199 }], 150) === 1 && columnAt([{ left: 0, right: 99 }], 500) === -1, "shared.js: columnAt");
    check(KANBAN.length === 4 && !KANBAN.includes("Hủy"), "shared.js: Kanban đúng bốn cột, không Hủy");

    await import(pathToFileURL(join(tmp, "kanban.js")));
    await settle();
    const q = (id) => document.getElementById(id);
    const find = (n, cls) => (n.className.split(" ").includes(cls) ? [n] : []).concat(...n.children.map((c) => find(c, cls)));
    const colCards = (i) => find(q("board").children[i], "kcard");
    const sttOf = (c) => find(c, "k-top")[0].children[0].textContent.replace("STT ", "");
    const stts = (i) => colCards(i).map(sttOf).join(",");
    const arrow = (stt, which) => {
      for (const c of find(q("board"), "kcard")) if (sttOf(c) === String(stt)) return find(c, "k-arrow")[which];
    };
    const click = async (b) => { for (const f of b.listeners.click ?? []) await f(); await settle(); };
    const notice = () => `${q("notice").className}|${q("notice").textContent}`;

    check(q("board").children.length === 4, "kanban.js: bốn cột");
    check(stts(0) === "1" && stts(1) === "" && stts(2) === "2" && stts(3) === "", `kanban.js: thẻ đúng cột (Chưa xử lý: ${stts(0)}; Chờ ý kiến: ${stts(2)}), Hủy bị ẩn`);
    check(q("hidden").textContent.includes("1 việc"), "kanban.js: ghi chú số việc Hủy bị ẩn");
    check(q("log").children.length === 1 && q("log").textContent.includes("Web · Kanban"), "kanban.js: nhật ký hiện dòng log web");
    check(arrow(1, 0).disabled === true && arrow(2, 1).disabled === false, "kanban.js: nút ‹ ở cột đầu bị khóa");

    await click(arrow(1, 0)); // bị khóa nhưng gọi thẳng: không được gửi
    check(posts.length === 0, "kanban.js: không gửi yêu cầu khi không có cột đích");

    await click(arrow(1, 1)); // STT 1: Chưa xử lý → Đang xử lý, thành công
    check(posts.length === 1 && JSON.stringify(posts[0]) === JSON.stringify({ stt: 1, from: "Chưa xử lý", to: "Đang xử lý" }), "kanban.js: gửi đúng {stt, from, to}");
    check(stts(1) === "1" && stts(0) === "", "kanban.js: thành công, thẻ ở cột Đang xử lý trong lúc chờ Sheets xác nhận");
    check(notice().startsWith("notice ok") && notice().includes("gỡ 1 sự kiện"), `kanban.js: thông báo thành công nêu lịch (${notice()})`);

    postMode = "409";
    await click(arrow(2, 1)); // STT 2: Chờ ý kiến → Đã xong, nhưng nơi khác đã đổi
    check(stts(2) === "2" && stts(3) === "", "kanban.js: 409 hoàn tác, thẻ về cột cũ");
    check(notice().startsWith("notice err") && notice().includes("nơi khác"), `kanban.js: 409 có thông báo (${notice()})`);

    postMode = "net";
    await click(arrow(2, 1));
    check(stts(2) === "2" && notice().includes("Không kết nối"), "kanban.js: mất mạng hoàn tác, có thông báo");
    postMode = "502";
    await click(arrow(2, 0));
    check(stts(2) === "2" && notice().startsWith("notice err") && notice().includes("giữ nguyên"), "kanban.js: lỗi 502 hoàn tác");
    check(posts.length === 4, `kanban.js: tổng 4 yêu cầu ghi (đúng ${posts.length})`);
  } catch (e) { check(false, `kanban.js: ${e.stack ?? e.message}`); }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? `${failed} phép kiểm LỖI` : "Tất cả đạt");
process.exit(failed ? 1 : 0);
