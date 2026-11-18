// Kanban (G4-03, PLAN.md D16, D47, D49). Mọi văn bản từ Sheets gán bằng textContent, không dùng innerHTML.
// Kéo thẻ (chuột; cảm ứng: nhấn giữ) hoặc bấm nút mũi tên → POST /api/task-status; lỗi thì thẻ về cột cũ.
import { el, fmtDate, KANBAN, shiftStatus, columnAt, daysUntil } from "/shared.js";

const POLL_MS = 12000;
const HOLD_MS = 250; // cảm ứng: nhấn giữ chừng này mới bắt đầu kéo, để vuốt dọc vẫn cuộn trang
const CONFIRM_MS = 20000; // chờ bản đọc Sheets xác nhận trạng thái mới; quá hạn thì theo Sheets
const DOT = { "Chưa xử lý": "grey", "Đang xử lý": "green", "Chờ ý kiến": "amber", "Đã xong": "green" };
const CHANNEL = { web: "Web · Kanban", zalo: "Zalo", telegram: "Telegram", ui: "Giao diện điều khiển" };
const ACTION = { doi_trang_thai: "Đổi trạng thái", huy: "Hủy việc", them: "Thêm việc", doi_han: "Đổi hạn", sua: "Sửa" };

const state = { data: null, log: null, prio: "", pending: new Map(), drag: null, dirty: false };
const $ = (id) => document.getElementById(id);

// Trạng thái hiển thị: ghi đè bằng thao tác đang chờ (đang ghi hoặc chờ xác nhận).
const shown = (r) => state.pending.get(Number(r.stt))?.to ?? r.status;
const titleOf = (r) => r.doc_title?.trim() || r.action_required?.trim() || "—";
const dueOf = (r) => r.due_date ?? r.doc_deadline;

function rank(r) {
  return r.overdue ? 0 : r.due_today || r.remind_due ? 1 : 2;
}
const byUrgency = (a, b) => rank(a) - rank(b) || (dueOf(a) ?? "9999").localeCompare(dueOf(b) ?? "9999") || Number(a.stt) - Number(b.stt);

function chip(text, cls) {
  return el("span", `k-chip ${cls}`, text);
}

function dueChip(r, today) {
  const due = dueOf(r);
  if (!due) return null;
  if (shown(r) === "Đã xong") return chip(`Hạn ${fmtDate(due).slice(0, 5)} · đã xong`, "ok");
  const n = daysUntil(today, due);
  const when = n < 0 ? `quá ${-n} ngày` : n === 0 ? "hôm nay" : n === 1 ? "ngày mai" : `còn ${n} ngày`;
  return chip(`Hạn ${fmtDate(due).slice(0, 5)} · ${when}`, n < 0 ? "late" : n <= 1 ? "soon" : "");
}

function card(r, today, canWrite) {
  const stt = Number(r.stt);
  const p = state.pending.get(stt);
  const cls = ["kcard", r.overdue && shown(r) !== "Đã xong" ? "overdue" : "", p ? "pending" : ""].filter(Boolean).join(" ");
  const c = el("div", cls);
  c.dataset.stt = String(stt);
  const top = el("div", "k-top");
  top.append(el("strong", "", `STT ${stt}`), el("span", "k-num", r.doc_number ?? "—"));
  const title = el("div", "k-title", titleOf(r));
  c.append(top, title);
  if (r.doc_title?.trim() && r.action_required?.trim()) c.append(el("div", "k-sub", r.action_required));
  const chips = el("div", "k-chips");
  const d = dueChip(r, today);
  if (d) chips.append(d);
  if (r.remind_date && shown(r) !== "Đã xong") chips.append(chip(`Nhắc ${fmtDate(r.remind_date).slice(0, 5)}`, "remind"));
  if (r.priority === "Cao") chips.append(chip("Ưu tiên cao", "high"));
  if ([r.doc_title, r.action_required, r.doc_number].some((v) => v?.includes("(cần kiểm tra)"))) chips.append(chip("(cần kiểm tra)", "check"));
  c.append(chips);
  const foot = el("div", "k-foot");
  foot.append(el("span", "k-state", p ? (p.phase === "writing" ? "Đang ghi…" : "Đã ghi, chờ xác nhận…") : ""));
  if (canWrite) {
    const arrows = el("span", "k-arrows");
    for (const [delta, sym, label] of [[-1, "‹", "Chuyển về cột trước"], [1, "›", "Chuyển sang cột sau"]]) {
      const target = shiftStatus(shown(r), delta);
      const b = el("button", "k-arrow", sym);
      b.type = "button";
      b.setAttribute("aria-label", target ? `${label}: ${target}` : label);
      b.disabled = !target || Boolean(p);
      b.addEventListener("click", () => move(stt, target));
      arrows.append(b);
    }
    foot.append(arrows);
  }
  c.append(foot);
  if (canWrite && !p) attachDrag(c, stt);
  return c;
}

function renderBoard() {
  const { rows, today, can_write: canWrite } = state.data;
  const visible = rows.filter((r) => KANBAN.includes(shown(r)) && (!state.prio || r.priority === state.prio));
  $("board").replaceChildren(...KANBAN.map((status) => {
    const list = visible.filter((r) => shown(r) === status).sort(byUrgency);
    const col = el("div", "kcol");
    col.dataset.status = status;
    const head = el("div", "kcol-head");
    head.append(el("span", `k-dot ${DOT[status]}`), el("strong", "", status), el("span", "k-count", String(list.length)));
    const body = el("div", "kcol-body");
    body.append(...list.map((r) => card(r, today, canWrite)));
    if (!list.length) body.append(el("p", "muted k-empty", "Không có việc"));
    col.append(head, body);
    return col;
  }));
  const hidden = rows.length - rows.filter((r) => KANBAN.includes(r.status)).length;
  $("hidden").textContent = `Việc Hủy hoặc chưa có trạng thái (${hidden} việc) được ẩn khỏi Kanban, vẫn xem được ở Biểu theo dõi, mục "Tất cả, kể cả Hủy". Trên điện thoại dùng hai nút mũi tên trên thẻ để chuyển cột.`;
  if (!canWrite) setNotice("warn", "Chưa bật ghi từ web: Kanban chỉ để xem.", true);
}

function renderPrio() {
  $("prio").replaceChildren(...[["", "Mọi ưu tiên"], ["Cao", "Cao"], ["Thường", "Thường"]].map(([val, label]) => {
    const b = el("button", val === state.prio ? "on" : "", label);
    b.type = "button";
    b.addEventListener("click", () => { state.prio = val; render(); });
    return b;
  }));
}

function renderSync() {
  const { data } = state;
  const age = Math.max(0, Math.round((Date.now() - Date.parse(data.fetched_at)) / 1000));
  $("dot").className = `dot ${data.stale ? "stale" : "live"}`;
  $("syncText").textContent = data.stale ? `Dữ liệu cũ ${age} giây (chưa đọc được Google)` : `Cùng dữ liệu với Biểu theo dõi · đồng bộ ${age} giây trước`;
}

const timeText = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;
function renderLog() {
  const entries = state.log?.entries ?? [];
  $("logEmpty").hidden = entries.length > 0;
  $("log").replaceChildren(...entries.slice(0, 12).map((e) => {
    const li = el("li");
    const when = el("div", "log-when");
    when.append(el("strong", "", timeText(e.time)), el("span", "muted", CHANNEL[e.channel] ?? e.channel));
    const what = el("div", "log-what");
    what.append(el("strong", "", `${e.stt !== null ? `STT ${e.stt}: ` : ""}${ACTION[e.action] ?? e.action}`), el("span", "muted", e.summary));
    li.append(when, what);
    return li;
  }));
}

function render() {
  if (!state.data) return;
  if (state.drag?.active) return void (state.dirty = true); // không dựng lại giữa lúc kéo
  if (state.drag) cancel(state.drag); // chưa kéo: thẻ sắp bị dựng lại
  state.dirty = false;
  renderPrio();
  renderBoard();
  renderSync();
  renderLog();
}

let noticeTimer = null;
function setNotice(kind, text, sticky = false) {
  const n = $("notice");
  n.textContent = text;
  n.className = `notice ${kind}`;
  n.hidden = false;
  clearTimeout(noticeTimer);
  if (!sticky) noticeTimer = setTimeout(() => { n.hidden = true; }, 9000);
}

// Thao tác đang chờ được Sheets xác nhận (hoặc quá hạn) thì bỏ ghi đè.
function applyData(data) {
  state.data = data;
  for (const [stt, p] of state.pending) {
    if (p.phase !== "confirming") continue;
    const row = data.rows.find((r) => Number(r.stt) === stt);
    if (!row || row.status === p.to || Date.now() - p.at > CONFIRM_MS) state.pending.delete(stt);
  }
}

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401) {
    location.replace("/login");
    throw new Error("401");
  }
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

async function poll() {
  try {
    applyData(await getJson("/api/tasks"));
    state.log = await getJson("/api/log").catch(() => state.log);
    render();
  } catch {
    if (state.data) state.data.stale = true;
    $("syncText").textContent = "Không kết nối được máy chủ";
    $("dot").className = "dot stale";
  }
}

function calendarText(r) {
  if (r.calendar === "failed") return "Đã ghi biểu, chưa đồng bộ được lịch (job đối chiếu sẽ vá).";
  if (r.calendar?.deleted) return `Đã ghi Sheets; gỡ ${r.calendar.deleted} sự kiện [Nhắc]/[Hạn] trên lịch.`;
  if (r.calendar?.created) return `Đã ghi Sheets; tạo lại ${r.calendar.created} sự kiện trên lịch.`;
  if (r.calendar?.moved) return `Đã ghi Sheets; dời ${r.calendar.moved} sự kiện trên lịch.`;
  return "Đã ghi Sheets; lịch không cần đổi.";
}

// Đổi trạng thái việc stt sang cột to. Cùng cột thì không gửi gì.
async function move(stt, to) {
  const row = state.data?.rows.find((r) => Number(r.stt) === stt);
  if (!row || !to || state.pending.has(stt)) return;
  const from = shown(row);
  if (from === to || !KANBAN.includes(from) || !KANBAN.includes(to)) return;
  state.pending.set(stt, { from, to, phase: "writing", at: Date.now() });
  render();
  const undo = (kind, text) => {
    state.pending.delete(stt);
    setNotice(kind, text);
    render();
  };
  let res;
  try {
    res = await fetch("/api/task-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stt, from, to }),
    });
  } catch {
    return undo("err", `Không kết nối được máy chủ: STT ${stt} giữ nguyên ở "${from}".`);
  }
  if (res.status === 401) return void location.replace("/login");
  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    state.pending.set(stt, { from, to, phase: "confirming", at: Date.now() });
    setNotice(body.log_warning ? "warn" : "ok", `STT ${stt}: ${from} → ${to}. ${calendarText(body)}${body.log_warning ? " Chưa ghi được dòng log, cần báo anh Khải." : ""}`);
    render();
    return void poll();
  }
  if (res.status === 409) {
    state.pending.delete(stt);
    render();
    await poll();
    return setNotice("err", `STT ${stt} vừa được đổi ở nơi khác${body.current ? ` sang "${body.current}"` : ""}; chưa ghi gì, đã tải lại.`);
  }
  return undo("err", `${body.error ?? "Chưa ghi được"}: STT ${stt} giữ nguyên ở "${from}".`);
}

// ---- Kéo thả bằng Pointer Events (HTML5 drag không chạy trên Safari cảm ứng) ----
function attachDrag(cardEl, stt) {
  cardEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button") || state.drag) return;
    const d = { stt, el: cardEl, id: e.pointerId, x0: e.clientX, y0: e.clientY, active: false, touch: e.pointerType !== "mouse", timer: null };
    state.drag = d;
    try { cardEl.setPointerCapture(e.pointerId); } catch {} // chuột nhả ngoài thẻ vẫn gửi pointerup về thẻ
    if (d.touch) d.timer = setTimeout(() => begin(d), HOLD_MS);
  });
  cardEl.addEventListener("pointermove", (e) => {
    const d = state.drag;
    if (!d || d.el !== cardEl || e.pointerId !== d.id) return;
    if (!d.touch && e.buttons === 0) return void cancel(d); // nhả chuột ngoài thẻ: không để kéo "kẹt"
    const dist = Math.hypot(e.clientX - d.x0, e.clientY - d.y0);
    if (!d.active) {
      if (!d.touch && dist > 6) begin(d);
      else if (d.touch && dist > 10) return void cancel(d); // vuốt trước khi giữ đủ lâu: để trang cuộn
      if (!d.active) return;
    }
    d.el.style.transform = `translate(${e.clientX - d.x0}px, ${e.clientY - d.y0}px)`;
    const cols = [...document.querySelectorAll(".kcol")];
    const idx = columnAt(document.elementsFromPoint(e.clientX, e.clientY), cols, d.el);
    cols.forEach((c, i) => c.classList.toggle("drop", i === idx));
    d.target = idx;
  });
  const end = (e, commit) => {
    const d = state.drag;
    if (!d || d.el !== cardEl || e.pointerId !== d.id) return;
    const target = commit && d.active ? d.target : -1;
    cancel(d);
    if (target >= 0) move(stt, KANBAN[target]);
  };
  cardEl.addEventListener("pointerup", (e) => end(e, true));
  cardEl.addEventListener("pointercancel", (e) => end(e, false));
}

function begin(d) {
  if (state.drag !== d) return;
  d.active = true;
  d.target = -1;
  d.el.classList.add("dragging");
}

function cancel(d) {
  clearTimeout(d.timer);
  d.el.classList.remove("dragging");
  d.el.style.transform = "";
  document.querySelectorAll(".kcol.drop").forEach((c) => c.classList.remove("drop"));
  state.drag = null;
  if (state.dirty) render();
}

// iOS: đã nhấn giữ để kéo thì chặn trang cuộn theo ngón tay.
document.addEventListener("touchmove", (e) => { if (state.drag?.active) e.preventDefault(); }, { passive: false });

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
setInterval(() => state.data && !state.drag?.active && renderSync(), 1000);
start();
