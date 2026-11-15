// Đăng nhập Google một lần để lấy refresh token Drive (scope drive.file), G2C-03, PLAN.md D39.
// Chạy trong image OpenClaw (có Node), KHÔNG mở cổng: in URL cấp quyền, anh dán lại URL trình duyệt chuyển tới.
// Cách chạy: xem deploy/README.md. Dùng: node google-oauth-login.mjs <oauth-client.json> <oauth-token.json>
import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";

const [clientFile, tokenFile] = process.argv.slice(2);
if (!clientFile || !tokenFile) {
  console.error("Cách dùng: node google-oauth-login.mjs <oauth-client.json> <oauth-token.json>");
  process.exit(2);
}
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const REDIRECT = "http://127.0.0.1:1/"; // không có gì lắng nghe; trình duyệt báo lỗi kết nối nhưng thanh địa chỉ có mã

const raw = JSON.parse(readFileSync(clientFile, "utf8"));
const client = raw.installed ?? raw;
if (!client.client_id || !client.client_secret) {
  console.error("oauth-client.json thiếu client_id hoặc client_secret (cần client loại Desktop)");
  process.exit(1);
}

const verifier = randomBytes(48).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const state = randomBytes(16).toString("hex");
const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
url.search = new URLSearchParams({
  client_id: client.client_id,
  redirect_uri: REDIRECT,
  response_type: "code",
  scope: SCOPE,
  code_challenge: challenge,
  code_challenge_method: "S256",
  state,
  access_type: "offline",
  prompt: "consent",
}).toString();

console.log("1) Mở địa chỉ sau trong trình duyệt, đăng nhập đúng tài khoản Google của dự án và cho phép:\n");
console.log(url.toString());
console.log("\n2) Trình duyệt sẽ báo không kết nối được tới 127.0.0.1 (bình thường). Chép TOÀN BỘ địa chỉ trên thanh địa chỉ lúc đó, dán vào đây rồi Enter:\n");
const rl = createInterface({ input: process.stdin, output: process.stdout });
const pasted = (await rl.question("> ")).trim();
rl.close();

let params;
try {
  params = new URL(pasted).searchParams;
} catch {
  console.error("Không phải địa chỉ hợp lệ.");
  process.exit(1);
}
if (params.get("error")) {
  console.error(`Google trả lỗi: ${params.get("error")}`);
  process.exit(1);
}
if (params.get("state") !== state) {
  console.error("Sai mã state (địa chỉ không thuộc lần đăng nhập này).");
  process.exit(1);
}
const code = params.get("code");
if (!code) {
  console.error("Địa chỉ không có tham số code.");
  process.exit(1);
}

const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: client.client_id,
    client_secret: client.client_secret,
    redirect_uri: REDIRECT,
    code_verifier: verifier,
  }),
});
const body = await res.json().catch(() => ({}));
if (!res.ok || !body.refresh_token) {
  console.error(`Đổi mã không được (HTTP ${res.status}${body.error ? `, ${body.error}` : ""}${res.ok ? ", không có refresh_token" : ""}).`);
  process.exit(1);
}
if (!String(body.scope ?? "").split(" ").includes(SCOPE)) {
  console.error("Token không có quyền drive.file.");
  process.exit(1);
}
writeFileSync(tokenFile, `${JSON.stringify({ refresh_token: body.refresh_token, scope: body.scope, obtained_at: new Date().toISOString() }, null, 2)}\n`, { mode: 0o600 });
chmodSync(tokenFile, 0o600);
console.log(`\nĐã lưu refresh token vào ${tokenFile} (không in ra màn hình).`);
