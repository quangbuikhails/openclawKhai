// Lịch công việc (chỉ đọc). Mốc từ biểu (/api/tasks) cộng lịch hẹn (/api/events). Văn bản gán bằng textContent.
import { el, fmtDate, WEEKDAY, addDays, taskDetails, cellNode } from "/shared.js";

const POLL_MS = 12000;
const $ = (id) => document.getElementById(id);
const phone = () => matchMedia("(max-width: 767px)").matches;
const KIND = { nhac: "[Nhắc]", han: "[Hạn]", hen: "Lịch hẹn" };
const SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const state = { tasks: null, events: null, upcoming: null, mode: phone() ? "week" : "month", anchor: null, sel: null, selDay: null };

// ---- Ngày (Asia/Ho_Chi_Minh; ngày dạng yyyy-mm-dd) ----
const dow = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const mondayOf = (iso) => addDays(iso, -((dow(iso) + 6) % 7));
const vn = (ts) => new Date(Date.parse(ts) + 7 * 3600000).toISOString(); // yyyy-mm-ddTHH:mm... theo giờ VN
const dayOf = (ts) => (ts.length === 10 ? ts : vn(ts).slice(0, 10));
const hhmm = (ts) => vn(ts).slice(11, 16);
const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
const addMonths = (iso, n) => {
  const d = new Date(`${monthStart(iso)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

function range() {
  const a = state.anchor;
  if (state.mode === "week") {
    const from = mondayOf(a);
    return { from, to: addDays(from, 6) };
  }
  const from = mondayOf(monthStart(a));
  const last = addDays(addMonths(a, 1), -1);
  return { from, to: addDays(mondayOf(last), 6) };
}

// ---- Gom mục theo ngày ----
const gist = (r) => (r.doc_title?.trim() ? r.doc_title : r.action_required?.trim() ? r.action_required : "—");
const taskLabel = (r) => `${r.doc_number ? `${r.doc_number} – ` : ""}${gist(r)}`;

// Quy tắc của khai-mcp-google (mcp-google/server.mjs, desiredDates): việc Đã xong/Hủy không có mốc;
// [Nhắc] theo Ngày nhắc việc (cột N), [Hạn] theo Hạn hoàn thành (cột H). Cột M không tạo [Hạn].
function taskItems() {
  const { rows, today } = state.tasks;
  const out = [];
  for (const r of rows) {
    if (!r.open) continue;
    if (r.remind_date) out.push({ id: `nhac-${r.row}`, kind: "nhac", day: r.remind_date, label: taskLabel(r), rec: r, tone: r.remind_date <= today ? "warn" : "" });
    if (r.due_date) out.push({ id: `han-${r.row}`, kind: "han", day: r.due_date, label: taskLabel(r), rec: r, tone: r.due_date < today ? "late" : "" });
  }
  return out;
}

// Sự kiện có kind là [Nhắc]/[Hạn] do server đồng bộ từ biểu: đã có ở trên, không hiện lại.
function eventItems(list) {
  const out = [];
  for (const e of list ?? []) {
    if (e.kind || !e.start) continue;
    const allDay = e.start.length === 10;
    const first = dayOf(e.start);
    let last = first;
    if (allDay && e.end) last = addDays(e.end, -1);
    if (last < first) last = first;
    const time = allDay ? "Cả ngày" : `${hhmm(e.start)}${e.end ? `–${hhmm(e.end)}` : ""}`;
    for (let d = first, n = 0; d <= last && n < 14; d = addDays(d, 1), n++) {
      out.push({ id: `hen-${e.id}-${d}`, kind: "hen", day: d, label: e.summary || "(không tiêu đề)", time, sort: allDay ? "00:00" : hhmm(e.start), ev: e });
    }
  }
  return out;
}

const order = { han: 0, nhac: 1, hen: 2 };
const sortItems = (a, b) => order[a.kind] - order[b.kind] || (a.sort ?? "").localeCompare(b.sort ?? "") || String(a.label).localeCompare(b.label);

function itemsByDay(events) {
  const map = new Map();
  for (const it of [...taskItems(), ...eventItems(events)]) {
    if (!map.has(it.day)) map.set(it.day, []);
    map.get(it.day).push(it);
  }
  for (const l of map.values()) l.sort(sortItems);
  return map;
}

// ---- Vẽ ----
function chip(it) {
  const b = el("button", `chip-item ${it.kind} ${it.tone ?? ""} ${state.sel === it.id ? "on" : ""}`);
  b.type = "button";
  const tag = it.kind === "hen" ? it.time : KIND[it.kind];
  b.append(el("b", "", `${tag} `), document.createTextNode(it.label));
  b.title = `${tag} ${it.label}`;
  b.addEventListener("click", () => { state.sel = it.id; state.selDay = null; render(); if (phone()) $("detail").scrollIntoView({ block: "nearest" }); });
  return b;
}

function dayCell(day, items, ctx) {
  const today = state.tasks.today;
  const c = el("div", `day ${day === today ? "now" : ""} ${ctx.other ? "other" : ""} ${state.selDay === day ? "pick" : ""}`);
  const num = day.slice(8, 10);
  c.append(el("div", "day-head", state.mode === "month" ? (num === "01" ? `${num}/${day.slice(5, 7)}` : num) : `${SHORT[dow(day)]} ${num}/${day.slice(5, 7)}`));
  const list = el("div", "day-items");
  if (items.length === 0 && ctx.list) list.append(el("span", "muted", "Không có"));
  items.forEach((it) => list.append(chip(it)));
  c.append(list);
  // Điện thoại, màn tháng: chấm màu thay chữ; bấm ngày để xem danh sách.
  const dots = el("div", "dots");
  items.slice(0, 6).forEach((it) => dots.append(el("i", `dot-${it.kind} ${it.tone ?? ""}`)));
  c.append(dots);
  c.addEventListener("click", (e) => { if (e.target.closest(".chip-item")) return; state.selDay = day; state.sel = null; render(); });
  return c;
}

function renderGrid() {
  const { from, to } = range();
  const map = itemsByDay(state.events);
  const grid = $("grid");
  grid.className = `cal-grid ${state.mode}`;
  const nodes = [];
  if (state.mode === "month") SHORT.slice(1).concat(SHORT[0]).forEach((n) => nodes.push(el("div", "dow", n)));
  const month = state.anchor.slice(0, 7);
  for (let d = from; d <= to; d = addDays(d, 1)) nodes.push(dayCell(d, map.get(d) ?? [], { other: state.mode === "month" && d.slice(0, 7) !== month, list: state.mode === "week" }));
  grid.replaceChildren(...nodes);
  $("title").textContent = state.mode === "week" ? `${fmtDate(from).slice(0, 5)} – ${fmtDate(to)}` : `Tháng ${state.anchor.slice(5, 7)}/${state.anchor.slice(0, 4)}`;
  const cut = (state.events ?? []).length >= 250;
  $("note").textContent = cut ? "Có quá nhiều lịch hẹn, có thể chưa hiện hết." : "";
  return map;
}

function findItem(id, map) {
  for (const l of map.values()) { const f = l.find((x) => x.id === id); if (f) return f; }
  return null;
}

function renderDetail(map) {
  const box = $("detail");
  box.replaceChildren();
  box.hidden = true;
  if (state.selDay) {
    box.hidden = false;
    box.append(el("h3", "", `${WEEKDAY[dow(state.selDay)]} ${fmtDate(state.selDay)}`));
    const items = map.get(state.selDay) ?? [];
    if (!items.length) box.append(el("p", "muted", "Không có mục nào."));
    items.forEach((it) => box.append(chip(it)));
    return;
  }
  const it = state.sel ? findItem(state.sel, map) : null;
  if (!it) return;
  box.hidden = false;
  box.append(el("span", `pill ${it.kind}`, it.kind === "hen" ? "Lịch hẹn" : `${KIND[it.kind]} · STT ${it.rec.stt ?? ""}`));
  box.append(el("h3", "", it.kind === "hen" ? it.label : taskLabel(it.rec)));
  box.append(el("p", "muted", `${WEEKDAY[dow(it.day)]} ${fmtDate(it.day)}${it.kind === "hen" ? ` · ${it.time}` : ""}`));
  if (it.kind === "hen") return; // D47: lịch hẹn chỉ tiêu đề và giờ
  const st = el("p"); st.append(el("span", "muted", "Trạng thái: "), cellNode(it.rec, "status"));
  const due = el("p"); due.append(el("span", "muted", "Hạn hoàn thành: "), document.createTextNode(fmtDate(it.rec.due_date) || "—"));
  box.append(st, due, taskDetails(it.rec));
  const open = el("a", "btn small", "Mở Biểu theo dõi");
  open.href = "/";
  box.append(open);
}

function renderUpcoming() {
  const box = $("upList");
  if (!state.upcoming || !state.tasks) return;
  const { today } = state.tasks;
  const map = itemsByDay(state.upcoming);
  const rows = [];
  for (let d = today; d <= addDays(today, 6); d = addDays(d, 1)) {
    for (const it of map.get(d) ?? []) {
      const r = el("button", "up-row");
      r.type = "button";
      r.append(el("span", "up-day", `${SHORT[dow(d)]} ${d.slice(8, 10)}/${d.slice(5, 7)}`));
      const t = el("span", "up-text");
      t.append(el("b", `kind ${it.kind}`, it.kind === "hen" ? `Lịch hẹn · ${it.time}` : `${KIND[it.kind]} STT ${it.rec.stt ?? ""}`), el("span", "", it.label));
      r.append(t);
      r.addEventListener("click", () => { state.anchor = d; state.sel = it.id; state.selDay = null; poll(); });
      rows.push(r);
    }
  }
  box.replaceChildren(...(rows.length ? rows : [el("p", "muted", "Không có mục nào trong 7 ngày tới.")]));
}

function renderMode() {
  $("mode").replaceChildren(...[["month", "Tháng"], ["week", "Tuần"]].map(([k, label]) => {
    const b = el("button", k === state.mode ? "on" : "", label);
    b.type = "button";
    b.addEventListener("click", () => { state.mode = k; state.sel = null; state.selDay = null; poll(); });
    return b;
  }));
}

function renderSync() {
  const t = state.tasks;
  if (!t) return;
  const age = Math.max(0, Math.round((Date.now() - Date.parse(t.fetched_at)) / 1000));
  const stale = t.stale || state.events === null;
  $("dot").className = `dot ${stale ? "stale" : "live"}`;
  $("syncText").textContent = stale ? `Dữ liệu cũ hoặc chưa đủ (Google chưa đọc được) · biểu ${age} giây trước` : `Google Sheets (biểu) và Calendar "Công việc" · đồng bộ ${age} giây trước`;
}

function render() {
  if (!state.tasks || !state.anchor) return;
  renderMode();
  const map = renderGrid();
  renderDetail(map);
  renderUpcoming();
  renderSync();
}

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401) { location.replace("/login"); throw new Error("401"); }
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

let busy = false;
async function poll() {
  if (busy) return;
  busy = true;
  try {
    state.tasks = await getJson("/api/tasks");
    state.anchor ??= state.tasks.today;
    const { from, to } = range();
    const [ev, up] = await Promise.allSettled([
      getJson(`/api/events?from=${from}&to=${to}`),
      phone() ? Promise.resolve(null) : getJson(`/api/events?from=${state.tasks.today}&to=${addDays(state.tasks.today, 6)}`),
    ]);
    state.events = ev.status === "fulfilled" ? ev.value.events : null; // lỗi: không giả vờ ngày trống, báo dữ liệu chưa đủ
    state.upcoming = up.status === "fulfilled" && up.value ? up.value.events : state.upcoming;
    render();
  } catch {
    $("syncText").textContent = "Không kết nối được máy chủ";
    $("dot").className = "dot stale";
  } finally {
    busy = false;
  }
}

const move = (n) => {
  if (!state.anchor) return;
  state.anchor = state.mode === "week" ? addDays(state.anchor, 7 * n) : addMonths(state.anchor, n);
  state.sel = null; state.selDay = null;
  state.events = null;
  poll();
};
$("prev").addEventListener("click", () => move(-1));
$("next").addEventListener("click", () => move(1));
$("todayBtn").addEventListener("click", () => { state.anchor = state.tasks?.today ?? null; state.sel = null; state.selDay = null; state.events = null; poll(); });
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
setInterval(renderSync, 1000);
start();
