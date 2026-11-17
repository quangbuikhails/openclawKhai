// Tạo secrets/web-admin.env cho web-admin (G4-02). Chạy trong container tạm (xem deploy/README.md), không cần mạng.
// Nhập ẩn: mật khẩu (2 lần), ID bảng tính, ID lịch. Không in, không ghi log giá trị nào; chỉ in tên khóa đã ghi.
// Thêm --hien để hiện ký tự khi gõ (chẩn đoán). Hai lần không khớp thì chỉ in độ dài, không in nội dung.
import { scryptSync, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, statSync } from "node:fs";

const OUT = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "/out.env";
const overwrite = process.argv.includes("--ghi-de");
if (!process.stdin.isTTY) {
  console.error("Cần chạy với -it để nhập ẩn.");
  process.exit(1);
}
if (statSync(OUT).size > 0 && !overwrite) {
  console.error(`${OUT} đã có nội dung. Thêm --ghi-de nếu muốn ghi lại (mật khẩu, khóa phiên mới).`);
  process.exit(1);
}

// Đọc từng ký tự ở chế độ raw. Một bộ đọc dùng chung cho mọi lần nhập, nên ký tự gõ trước không bị mất hay dính sang lần sau.
// Enter có thể là \r, \n hoặc \r\n (coi là một lần); Backspace (0x7f, 0x08); Ctrl-U xóa dòng; chuỗi ESC (phím mũi tên, dán có đánh dấu) bị bỏ qua.
const show = process.argv.includes("--hien");
let cur = null; // lần nhập đang chờ: { buf, resolve }
let pending = []; // ký tự đến khi chưa có lần nhập nào
let skipLF = false; // ký tự vừa đến là \r: bỏ \n đi liền sau
let esc = ""; // đang trong chuỗi ESC

// Lúc ký tự đến: \n ngay sau \r là nửa sau của Enter kiểu \r\n, bỏ đi (kể cả khi chưa có lần nhập nào chờ).
function feed(ch) {
  if (ch === "\n" && skipLF) return void (skipLF = false);
  skipLF = ch === "\r";
  if (!cur) return pending.push(ch);
  handle(ch);
}

function handle(ch) {
  if (esc) {
    if (esc === "\u001b") {
      esc = ch === "[" ? "\u001b[" : ""; // ESC + ký tự khác: bỏ cả hai
    } else if (ch >= "@" && ch <= "~") esc = ""; // hết chuỗi CSI
    return;
  }
  if (ch === "\u001b") return void (esc = ch);
  if (ch === "\r" || ch === "\n" || ch === "\u0004") {
    process.stdout.write("\n");
    const { buf, resolve } = cur;
    cur = null;
    return resolve(buf.replace(/^[\r\n]+|[\r\n]+$/g, ""));
  }
  if (ch === "\u0003") {
    process.stdout.write("\n");
    process.exit(130);
  }
  if (ch === "\u007f" || ch === "\b") {
    if (cur.buf.length && show) process.stdout.write("\b \b");
    cur.buf = cur.buf.slice(0, -1);
    return;
  }
  if (ch === "\u0015") {
    cur.buf = "";
    return;
  }
  if (ch < " ") return; // ký tự điều khiển khác: bỏ
  cur.buf += ch;
  if (show) process.stdout.write(ch);
}

process.stdin.setRawMode(true);
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  for (const ch of chunk) feed(ch);
});
process.stdin.resume();

function askHidden(label) {
  return new Promise((resolve) => {
    process.stdout.write(`${label}${show ? " (đang hiện ký tự)" : ""}: `);
    cur = { buf: "", resolve };
    const queued = pending;
    pending = [];
    for (const ch of queued) (cur ? handle(ch) : pending.push(ch)); // lần nhập này xong sớm thì phần còn lại để dành cho lần sau
  });
}

const password = await askHidden("Mật khẩu (từ 12 ký tự)");
if (password.length < 12) {
  console.error(`Mật khẩu quá ngắn (độ dài ${password.length}), chưa ghi gì.`);
  process.exit(1);
}
const again = await askHidden("Nhập lại mật khẩu");
if (again !== password) {
  console.error(`Hai lần không khớp (độ dài ${password.length} và ${again.length}), chưa ghi gì.`);
  process.exit(1);
}
const sheetId = (await askHidden("ID bảng tính")).trim();
const calendarId = (await askHidden("ID lịch")).trim();
// ID dán vào có thể kèm khoảng trắng hoặc ký tự lạ; chỉ nhận ký tự hợp lệ của ID Google và email lịch.
if (!/^[A-Za-z0-9_-]{20,}$/.test(sheetId) || !/^[A-Za-z0-9._%+@-]{5,}$/.test(calendarId)) {
  console.error("ID bảng tính hoặc ID lịch không đúng dạng, chưa ghi gì.");
  process.exit(1);
}

const N = 32768, r = 8, p = 1;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N, r, p, maxmem: 128 * 1024 * 1024 });
const entries = {
  WEB_PASSWORD_HASH: `scrypt:${N}:${r}:${p}:${salt.toString("base64url")}:${hash.toString("base64url")}`,
  SESSION_SECRET: randomBytes(32).toString("base64url"),
  WEB_SPREADSHEET_ID: sheetId,
  WEB_CALENDAR_ID: calendarId,
};
// Ghi tại chỗ (không đổi inode) vì tệp được mount từ host.
writeFileSync(OUT, Object.entries(entries).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
const back = readFileSync(OUT, "utf8").split("\n").filter(Boolean).map((l) => l.split("=")[0]);
console.log(`Đã ghi ${back.length} khóa: ${back.join(", ")}`);
process.exit(0);
