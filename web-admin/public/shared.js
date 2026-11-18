// Phần dùng chung của Biểu theo dõi và Lịch. Mọi văn bản từ Sheets gán bằng textContent, không dùng innerHTML.
export const COLUMNS = [
  ["stt", "STT"], ["received_date", "Ngày nhận"], ["doc_title", "Tên văn bản"], ["doc_number", "Số ký hiệu"],
  ["issuer", "Cơ quan ban hành"], ["action_required", "Nội dung cần xử lý"], ["owner", "Người phụ trách"],
  ["due_date", "Hạn hoàn thành"], ["priority", "Ưu tiên"], ["status", "Trạng thái"], ["note", "Ghi chú"],
  ["doc_link", "Tệp gốc"], ["doc_deadline", "Thời hạn trong văn bản"], ["remind_date", "Ngày nhắc việc"],
];
export const DATE_KEYS = new Set(["received_date", "due_date", "doc_deadline", "remind_date"]);

export const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
export const fmtDate = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
export const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
export const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export const rowClass = (r) => (r.overdue ? "overdue" : r.remind_due ? "remind" : "");

export function cellNode(r, key) {
  if (key === "doc_link") {
    if (!r.doc_link) return el("span", "muted", "—");
    const a = el("a", "btn small", "Mở tệp");
    a.href = r.doc_link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }
  const raw = DATE_KEYS.has(key) ? fmtDate(r[key]) : r[key];
  if (raw === null || raw === "") return el("span", "muted", "—");
  const text = String(raw);
  if (text.includes("(cần kiểm tra)")) {
    const span = el("span");
    text.split("(cần kiểm tra)").forEach((part, i, arr) => {
      span.append(document.createTextNode(part));
      if (i < arr.length - 1) span.append(el("b", "check", "(cần kiểm tra)"));
    });
    return span;
  }
  if (key === "status" || key === "priority") return el("span", `badge ${key}-${text.replaceAll(" ", "-")}`, text);
  return document.createTextNode(text);
}


// Chi tiết một việc (các trường như thẻ ở trang Biểu): danh sách trường và nút mở tệp gốc.
export function taskDetails(r) {
  const frag = document.createDocumentFragment();
  const body = el("dl", "card-body");
  COLUMNS.filter(([k]) => !["stt", "doc_title", "status", "priority", "doc_link"].includes(k)).forEach(([k, label]) => {
    const row = el("div");
    const dd = el("dd");
    dd.append(cellNode(r, k));
    row.append(el("dt", "", label), dd);
    body.append(row);
  });
  const link = el("div", "card-link");
  link.append(cellNode(r, "doc_link"));
  frag.append(body, link);
  return frag;
}

// Kanban (G4-03): bốn cột theo D16, Hủy ẩn. Hàm thuần để kiểm ngoại tuyến.
export const KANBAN = ["Chưa xử lý", "Đang xử lý", "Chờ ý kiến", "Đã xong"];
export const shiftStatus = (status, delta) => (KANBAN.includes(status) ? KANBAN[KANBAN.indexOf(status) + delta] ?? null : null);
export const columnAt = (rects, x) => rects.findIndex((r) => x >= r.left && x <= r.right);
export const daysUntil = (today, iso) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
