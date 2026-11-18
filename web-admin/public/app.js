// Giao diện Biểu theo dõi (chỉ đọc). Mọi văn bản từ Sheets gán bằng textContent, không dùng innerHTML.
import { COLUMNS, el, fmtDate, WEEKDAY, addDays, rowClass, cellNode, taskDetails } from "/shared.js";
const COMPACT = new Set(["stt", "doc_title", "doc_number", "due_date", "priority", "status", "doc_link"]);
const POLL_MS = 12000;

const state = { data: null, view: "open", prio: "", status: "", due: "", compact: false };
const $ = (id) => document.getElementById(id);

const VIEWS = [
  ["open", "Đang mở", (r) => r.open, "open"],
  ["urgent", "Cần làm ngay", (r) => r.urgent, "urgent"],
  ["overdue", "Quá hạn", (r) => r.overdue, "overdue"],
  ["done", "Đã xong", (r) => r.status === "Đã xong", "done"],
  ["all", "Tất cả, kể cả Hủy", () => true, "all"],
];

function visibleRows() {
  const { rows, today } = state.data;
  const view = VIEWS.find((v) => v[0] === state.view);
  const week = addDays(today, 7);
  return rows
    .filter(view[2])
    .filter((r) => !state.prio || r.priority === state.prio)
    .filter((r) => !state.status || r.status === state.status)
    .filter((r) => {
      const due = r.due_date ?? r.doc_deadline;
      if (state.due === "overdue") return r.overdue;
      if (state.due === "today") return due === today;
      if (state.due === "week") return due !== null && due >= today && due <= week;
      if (state.due === "none") return due === null;
      return true;
    })
    .sort((a, b) => {
      const rank = (r) => (r.overdue ? 0 : r.due_today || r.remind_due ? 1 : 2);
      const da = a.due_date ?? a.doc_deadline ?? "9999";
      const db = b.due_date ?? b.doc_deadline ?? "9999";
      return rank(a) - rank(b) || da.localeCompare(db) || Number(a.stt) - Number(b.stt);
    });
}

function renderTiles() {
  const c = state.data.counts;
  const items = [["Đang mở", c.open, ""], ["Hạn hôm nay", c.due_today, "warn-soft"], ["Đến ngày nhắc", c.remind_due, "warn"], ["Quá hạn", c.overdue, "danger"]];
  const box = $("tiles");
  box.replaceChildren(...items.map(([label, n, cls]) => {
    const t = el("div", `tile ${n > 0 ? cls : ""}`);
    t.append(el("span", "tile-label", label), el("strong", "tile-num", String(n)));
    return t;
  }));
}

function renderFilters() {
  const c = state.data.counts;
  const counts = { open: c.open, urgent: c.urgent, overdue: c.overdue, done: c.done, all: c.all };
  $("chips").replaceChildren(...VIEWS.map(([key, label, , ck]) => {
    const b = el("button", `chip ${key === state.view ? "on" : ""} ${key === "overdue" ? "red" : ""}`, `${label} (${counts[ck]})`);
    b.type = "button";
    b.addEventListener("click", () => { state.view = key; render(); });
    return b;
  }));
  const seg = (box, options, current, set) => box.replaceChildren(...options.map(([val, label]) => {
    const b = el("button", val === current ? "on" : "", label);
    b.type = "button";
    b.addEventListener("click", () => { set(val); render(); });
    return b;
  }));
  seg($("prio"), [["", "Mọi ưu tiên"], ["Cao", "Cao"], ["Thường", "Thường"]], state.prio, (v) => (state.prio = v));
  seg($("cols"), [[false, "Đủ 14 cột"], [true, "Gọn"]], state.compact, (v) => (state.compact = v));
}

function renderTable(rows) {
  const cols = COLUMNS.filter(([k]) => !state.compact || COMPACT.has(k));
  const head = el("tr");
  cols.forEach(([, label]) => head.append(el("th", "", label)));
  $("table").tHead.replaceChildren(head);
  $("table").tBodies[0].replaceChildren(...rows.map((r) => {
    const tr = el("tr", rowClass(r));
    cols.forEach(([k]) => {
      const td = el("td", k);
      td.append(cellNode(r, k));
      tr.append(td);
    });
    return tr;
  }));
}

// Tiêu đề thẻ trên điện thoại: Tên văn bản; trống thì Nội dung cần xử lý; cả hai trống thì null (hiện "—").
const cardTitleKey = (r) => (r.doc_title?.trim() ? "doc_title" : r.action_required?.trim() ? "action_required" : null);

function renderCards(rows) {
  $("cards").replaceChildren(...rows.map((r) => {
    const d = el("details", `card ${rowClass(r)}`);
    const s = el("summary");
    const top = el("div", "card-top");
    top.append(el("span", "card-stt", `#${r.stt ?? ""}`), cellNode(r, "status"), cellNode(r, "priority"));
    const title = el("div", "card-title");
    const titleKey = cardTitleKey(r);
    title.append(titleKey ? cellNode(r, titleKey) : el("span", "muted", "—"));
    const due = el("div", "card-due");
    due.append(el("span", "muted", "Hạn: "), document.createTextNode(fmtDate(r.due_date ?? r.doc_deadline) || "—"));
    s.append(top, title, due);
    d.append(s, taskDetails(r));
    return d;
  }));
}

function renderSync() {
  const { data } = state;
  const age = Math.max(0, Math.round((Date.now() - Date.parse(data.fetched_at)) / 1000));
  $("dot").className = `dot ${data.stale ? "stale" : "live"}`;
  $("syncText").textContent = data.stale ? `Dữ liệu cũ ${age} giây (chưa đọc được Google) · ` : `Google Sheets, trang bieu · đồng bộ ${age} giây trước · `;
  if (data.spreadsheet_url) {
    $("sheetLink").href = data.spreadsheet_url;
    $("sheetLink").hidden = false;
  }
}

function render() {
  if (!state.data) return;
  const [y, m, d] = state.data.today.split("-").map(Number);
  $("today").textContent = `Hôm nay: ${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${fmtDate(state.data.today)}`;
  renderTiles();
  renderFilters();
  renderSync();
  const rows = visibleRows();
  renderTable(rows);
  renderCards(rows);
  $("empty").hidden = rows.length > 0;
}

async function poll() {
  try {
    const res = await fetch("/api/tasks", { cache: "no-store" });
    if (res.status === 401) return location.replace("/login");
    if (!res.ok) throw new Error(String(res.status));
    state.data = await res.json();
    render();
  } catch {
    if (state.data) state.data.stale = true;
    $("syncText").textContent = "Không kết nối được máy chủ · ";
    $("dot").className = "dot stale";
  }
}

$("status").addEventListener("change", (e) => { state.status = e.target.value; render(); });
$("due").addEventListener("change", (e) => { state.due = e.target.value; render(); });
$("logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
  location.replace("/login");
});

let timer = null;
const start = () => { poll(); timer = setInterval(poll, POLL_MS); };
document.addEventListener("visibilitychange", () => {
  clearInterval(timer);
  if (!document.hidden) start();
});
setInterval(() => state.data && renderSync(), 1000);
start();
