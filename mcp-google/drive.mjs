// Công cụ Google Drive cho khai-mcp-google (G2C-03, PLAN.md D39).
// Drive dùng OAuth của chủ (scope drive.file, refresh token ở /run/secrets); Sheets và Calendar vẫn dùng Service Account.
// Tệp gốc văn bản đến lấy từ thư mục Gateway gắn chỉ đọc tại /inbox; server tự tìm tệp từ mã, không nhận đường dẫn từ mô hình.
import { readFileSync, readdirSync, lstatSync, realpathSync, openSync, readSync, closeSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const CLIENT_FILE = process.env.DRIVE_OAUTH_CLIENT_FILE ?? "/run/secrets/oauth-client.json";
const TOKEN_FILE = process.env.DRIVE_OAUTH_TOKEN_FILE ?? "/run/secrets/oauth-token.json";
const INBOX = process.env.INBOX_DIR ?? "/inbox";
const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const OWNER_MARK = "khai-pbs"; // appProperties.owner trên mọi thư mục, tệp server tạo
const ROOT_NAME = "Khải Phiên Bản Số";
const INCOMING_NAME = "Văn bản đến";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_REFS = 20;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
// Dấu thư mục do OpenClaw tạo (src/media/staged-inputs.ts); khớp đúng từng byte mới coi là tệp của Gateway.
const STAGED_MARKER = "# Raw task inputs remain private; copy outputs into the project to publish.\n*\n";
const STAGED_DIR = /^openclaw-staged-(?:[a-f0-9]{64}|[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/;
const REF_ID = /^[A-Za-z0-9][A-Za-z0-9._()-]{0,198}$/;
const KINDS = {
  ".jpg": { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  ".jpeg": { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  ".png": { mime: "image/png", magic: [0x89, 0x50, 0x4e, 0x47] },
  ".pdf": { mime: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46] },
  ".docx": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: [0x50, 0x4b, 0x03, 0x04] },
};

// ---- Cấu hình và xác thực OAuth ----
function loadConfig() {
  try {
    const client = JSON.parse(readFileSync(CLIENT_FILE, "utf8"));
    const c = client.installed ?? client.web ?? client;
    const token = JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
    if (!c.client_id || !c.client_secret || !token.refresh_token) return null;
    return { clientId: c.client_id, clientSecret: c.client_secret, refreshToken: token.refresh_token };
  } catch {
    return null;
  }
}
const config = loadConfig();
export const driveEnabled = config !== null;

let cached = { value: "", expiresAt: 0 };
async function accessToken() {
  if (!config) throw new Error("Drive chưa cấu hình (thiếu oauth-client.json hoặc oauth-token.json)");
  const now = Math.floor(Date.now() / 1000);
  if (cached.value && cached.expiresAt - 60 > now) return cached.value;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.error === "invalid_grant") throw new Error("Drive cần đăng nhập lại: refresh token hết hạn hoặc bị thu hồi. Anh chạy lại lệnh đăng nhập Drive.");
    throw new Error(`Google từ chối làm mới token Drive (HTTP ${res.status})`);
  }
  const body = await res.json();
  cached = { value: body.access_token, expiresAt: now + Number(body.expires_in ?? 3600) };
  return cached.value;
}

async function driveFetch(method, url, { json, body, headers } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : body,
  });
  // Không đưa nội dung phản hồi (có thể chứa dữ liệu) vào lỗi.
  if (!res.ok) throw new Error(`Drive API lỗi HTTP ${res.status}`);
  return res;
}
const driveJson = async (method, url, opts) => (await driveFetch(method, url, opts)).json();
const qs = (s) => `'${String(s).replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

// ---- Thư mục ----
async function findOne(q, fields = "id,name,webViewLink,appProperties") {
  const r = await driveJson("GET", `${API}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(`files(${fields})`)}&pageSize=10&spaces=drive`);
  return r.files ?? [];
}

async function ensureFolder(name, parentId) {
  const parentQ = parentId ? ` and ${qs(parentId)} in parents` : ` and 'root' in parents`;
  const found = await findOne(`mimeType=${qs(FOLDER_MIME)} and name=${qs(name)} and trashed=false${parentQ}`);
  if (found.length) return found[0];
  return driveJson("POST", `${API}?fields=${encodeURIComponent("id,name,webViewLink")}`, {
    json: { name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}), appProperties: { owner: OWNER_MARK } },
  });
}

async function ensureMonthFolder(receivedDate) {
  const root = await ensureFolder(ROOT_NAME);
  const incoming = await ensureFolder(INCOMING_NAME, root.id);
  const year = await ensureFolder(receivedDate.slice(0, 4), incoming.id);
  const month = await ensureFolder(receivedDate.slice(5, 7), year.id);
  return { folder: month, label: `${ROOT_NAME}/${INCOMING_NAME}/${receivedDate.slice(0, 4)}/${receivedDate.slice(5, 7)}` };
}

// ---- Tải lên (resumable), chống trùng theo SHA-256 ----
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function upload(parentId, name, mime, buf, hash) {
  const init = await driveFetch("POST", `${UPLOAD}?uploadType=resumable&fields=${encodeURIComponent("id,name,webViewLink")}`, {
    json: { name, parents: [parentId], appProperties: { owner: OWNER_MARK, sha256: hash } },
    headers: { "X-Upload-Content-Type": mime, "X-Upload-Content-Length": String(buf.length) },
  });
  const location = init.headers.get("location");
  if (!location) throw new Error("Drive không trả địa chỉ tải lên");
  return (await driveFetch("PUT", location, { body: buf, headers: { "Content-Type": mime } })).json();
}

// Cùng nội dung đã có trong thư mục thì dùng lại; cùng tên nhưng khác nội dung thì thêm _2, _3…
async function putFile(parentId, name, mime, buf) {
  const hash = sha256(buf);
  const same = await findOne(`appProperties has { key='sha256' and value=${qs(hash)} } and ${qs(parentId)} in parents and trashed=false`);
  if (same.length) return { ...same[0], reused: true };
  const dot = name.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  for (let n = 1; n <= 20; n++) {
    const candidate = n === 1 ? name : `${stem}_${n}${ext}`;
    if (!(await findOne(`name=${qs(candidate)} and ${qs(parentId)} in parents and trashed=false`, "id")).length) {
      return { ...(await upload(parentId, candidate, mime, buf, hash)), reused: false };
    }
  }
  throw new Error("Quá nhiều tệp trùng tên trong thư mục");
}

// ---- Tìm tệp gốc từ mã (không nhận đường dẫn) ----
export function normalizeRef(raw) {
  let id = String(raw).trim();
  const m = /^media(?::\/\/|\/)inbound\/(.+)$/i.exec(id);
  if (m) {
    try {
      id = decodeURIComponent(m[1]);
    } catch {
      throw new Error("Mã tệp không hợp lệ");
    }
  }
  if (id.startsWith("input-")) id = id.slice(6);
  if (!REF_ID.test(id) || id.includes("..")) throw new Error("Mã tệp không hợp lệ");
  return id;
}

function readHead(file, n) {
  const fd = openSync(file, "r");
  try {
    const b = Buffer.alloc(n);
    return b.subarray(0, readSync(fd, b, 0, n, 0));
  } finally {
    closeSync(fd);
  }
}

export function resolveRef(raw) {
  const id = normalizeRef(raw);
  const base = realpathSync(INBOX);
  const hits = [];
  for (const dir of readdirSync(base)) {
    if (!STAGED_DIR.test(dir)) continue;
    const file = path.join(base, dir, `input-${id}`);
    let st;
    try {
      st = lstatSync(file);
    } catch {
      continue;
    }
    if (!st.isFile() || st.isSymbolicLink()) continue;
    const real = realpathSync(file);
    if (!real.startsWith(base + path.sep)) continue;
    let marker = "";
    try {
      marker = readFileSync(path.join(base, dir, ".gitignore"), "utf8");
    } catch {}
    if (marker !== STAGED_MARKER) continue;
    hits.push({ real, size: st.size });
  }
  if (hits.length === 0) throw new Error(`Không tìm thấy tệp gốc cho mã ${id}`);
  if (hits.length > 1) throw new Error(`Mã ${id} khớp nhiều tệp`);
  const ext = path.extname(hits[0].real).toLowerCase();
  const kind = KINDS[ext];
  if (!kind) throw new Error(`Đuôi tệp ${ext || "(không có)"} không được nhận (chỉ jpg, png, pdf, docx)`);
  const head = readHead(hits[0].real, 4);
  if (!kind.magic.every((b, i) => head[i] === b)) throw new Error(`Nội dung tệp không khớp đuôi ${ext}`);
  return { file: hits[0].real, size: hits[0].size, ext: ext === ".jpeg" ? ".jpg" : ext, mime: kind.mime };
}

// ---- Tên tệp theo PLAN.md mục 4 ----
const BAD_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;
export function slug(text, max) {
  const s = String(text ?? "").replace(BAD_CHARS, " ").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max).trim() : s;
}
export function buildName({ receivedDate, docNumber, docTitle }) {
  const number = slug(String(docNumber ?? "").replaceAll("/", "-"), 60).replaceAll(" ", "") || "khong-so";
  return `${receivedDate}_${number}_${slug(docTitle, 60) || "khong-trich-yeu"}`;
}

// ---- Ghép nhiều ảnh JPEG thành PDF, không dùng package (DCTDecode nhúng nguyên byte JPEG) ----
function jpegInfo(buf) {
  let i = 2;
  let orientation = 1;
  let info = null;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) {
      i += marker === 0xff ? 1 : 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xe1 && buf.toString("latin1", i + 4, i + 10) === "Exif\0\0") {
      try {
        const t = i + 10; // đầu khối TIFF
        const le = buf.toString("latin1", t, t + 2) === "II";
        const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
        const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
        const ifd = t + u32(t + 4);
        const count = u16(ifd);
        for (let k = 0; k < count; k++) {
          const entry = ifd + 2 + k * 12;
          if (u16(entry) === 0x0112) orientation = u16(entry + 8);
        }
      } catch {
        orientation = 0; // EXIF hỏng: không chắc hướng, nên không ghép PDF
      }
    }
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) info = { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7), components: buf[i + 9] };
    i += 2 + len;
  }
  if (!info || !info.width || !info.height) throw new Error("Không đọc được kích thước ảnh JPEG");
  return { ...info, orientation };
}

export function jpegsToPdf(buffers) {
  const infos = buffers.map(jpegInfo);
  if (infos.some((x) => x.components !== 1 && x.components !== 3)) throw new Error("Ảnh JPEG có kênh màu không hỗ trợ ghép");
  const objects = []; // nội dung từng đối tượng (Buffer), số đối tượng = chỉ số + 1
  const add = (b) => objects.push(Buffer.isBuffer(b) ? b : Buffer.from(b, "latin1"));
  const pageIds = buffers.map((_, n) => 3 + n * 3);
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${buffers.length} >>`);
  buffers.forEach((jpg, n) => {
    const { width, height, components } = infos[n];
    const w = 595; // rộng A4 (điểm), cao theo tỉ lệ ảnh
    const h = Math.round((height * w) / width);
    const page = 3 + n * 3;
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${page + 1} 0 R >> >> /Contents ${page + 2} 0 R >>`);
    add(
      Buffer.concat([
        Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /${components === 1 ? "DeviceGray" : "DeviceRGB"} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, "latin1"),
        jpg,
        Buffer.from("\nendstream", "latin1"),
      ]),
    );
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  const parts = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets = [];
  let pos = parts[0].length;
  objects.forEach((body, i) => {
    const head = Buffer.from(`${i + 1} 0 obj\n`, "latin1");
    const tail = Buffer.from("\nendobj\n", "latin1");
    offsets.push(pos);
    parts.push(head, body, tail);
    pos += head.length + body.length + tail.length;
  });
  const xref = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)].join("");
  parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`, "latin1"));
  return Buffer.concat(parts);
}

// ---- Đăng ký công cụ ----
export function registerDriveTools({ tool, serialized, ok, fail, z, isoDate, shortText, todayIso, testMode }) {
  const testDenied = (name) => (testMode && !String(name ?? "").includes("[TEST]") ? "Từ chối: đang ở chế độ test, trích yếu/tên tệp phải có [TEST]" : null);

  tool(
    "drive_save_document",
    "Tải tệp gốc của văn bản lên Drive riêng của chủ (Khải Phiên Bản Số/Văn bản đến/<năm>/<tháng>), không chia sẻ cho ai. refs: mã tệp đính kèm lấy từ ghi chú media của tin (phần sau media://inbound/), theo thứ tự các trang. Một tệp: tải nguyên bản; nhiều ảnh JPEG: ghép thành một PDF; nhiều tệp khác: để chung một thư mục con. Tên tệp do server đặt theo ngày nhận, số ký hiệu, trích yếu. Chỉ gọi sau khi chủ đã xác nhận. Trả về link để điền Link tài liệu của biểu.",
    {
      refs: z.array(shortText(200).min(1)).min(1).max(MAX_REFS),
      doc_title: shortText(300).min(1),
      doc_number: shortText(100).optional(),
      received_date: isoDate.optional().describe("Ngày nhận; mặc định hôm nay"),
    },
    (a) =>
      serialized(async () => {
        if (!driveEnabled) return fail("Drive chưa cấu hình");
        const denied = testDenied(a.doc_title);
        if (denied) return fail(denied);
        const files = a.refs.map(resolveRef);
        if (new Set(files.map((f) => f.file)).size !== files.length) return fail("Có mã tệp trùng nhau");
        if (files.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) return fail("Tổng dung lượng tệp quá 25 MB");
        const buffers = files.map((f) => readFileSync(f.file));
        const receivedDate = a.received_date ?? todayIso();
        const base = buildName({ receivedDate, docNumber: a.doc_number, docTitle: a.doc_title });
        const { folder, label } = await ensureMonthFolder(receivedDate);

        let mode;
        let saved;
        if (files.length === 1) {
          mode = "file";
          saved = await putFile(folder.id, `${base}${files[0].ext}`, files[0].mime, buffers[0]);
        } else {
          const allJpeg = files.every((f) => f.ext === ".jpg");
          const upright = allJpeg && buffers.every((b) => jpegInfo(b).orientation === 1);
          if (upright) {
            mode = "pdf";
            saved = await putFile(folder.id, `${base}.pdf`, "application/pdf", jpegsToPdf(buffers));
          } else {
            mode = "folder";
            const sub = await ensureFolder(base, folder.id);
            for (let n = 0; n < files.length; n++) {
              await putFile(sub.id, `${base}_${String(n + 1).padStart(2, "0")}${files[n].ext}`, files[n].mime, buffers[n]);
            }
            saved = { ...sub, reused: false };
          }
        }
        return ok({ file_id: saved.id, name: saved.name, link: saved.webViewLink, folder: label, mode, pages: files.length, reused: Boolean(saved.reused) });
      }),
  );

  tool(
    "drive_trash",
    "Chuyển vào thùng rác một tệp hoặc thư mục do trợ lý tạo trên Drive (khôi phục được, không xóa vĩnh viễn). Chỉ gọi sau khi chủ đã xác nhận rõ tệp nào. Tệp không do trợ lý tạo bị từ chối.",
    { file_id: z.string().regex(/^[A-Za-z0-9_-]{10,100}$/) },
    ({ file_id }) =>
      serialized(async () => {
        if (!driveEnabled) return fail("Drive chưa cấu hình");
        const meta = await driveJson("GET", `${API}/${file_id}?fields=${encodeURIComponent("id,name,trashed,appProperties")}`).catch(() => null);
        if (!meta || meta.appProperties?.owner !== OWNER_MARK) return fail("Từ chối: không phải tệp do trợ lý tạo");
        const denied = testDenied(meta.name);
        if (denied) return fail(denied);
        if (meta.trashed) return ok({ file_id, trashed: true, unchanged: true });
        await driveJson("PATCH", `${API}/${file_id}?fields=id`, { json: { trashed: true } });
        return ok({ file_id, name: meta.name, trashed: true });
      }),
  );
}
