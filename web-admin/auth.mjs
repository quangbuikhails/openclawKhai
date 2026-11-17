// Mật khẩu một người dùng (scrypt), cookie phiên ký HMAC không giữ trạng thái, giới hạn đăng nhập (PLAN.md D47).
import { scryptSync, timingSafeEqual, createHmac, randomBytes } from "node:crypto";

const HASH = process.env.WEB_PASSWORD_HASH ?? ""; // scrypt:N:r:p:salt:hash (base64url, không có "$")
const SECRET = process.env.SESSION_SECRET ?? "";
export const SESSION_HOURS = 12;
export const COOKIE = "kpbs_session";

export const authReady = () => HASH.split(":").length === 6 && SECRET.length >= 32;

const same = (a, b) => a.length === b.length && timingSafeEqual(a, b);

export function checkPassword(password) {
  const [kind, N, r, p, salt, hash] = HASH.split(":");
  if (kind !== "scrypt" || typeof password !== "string" || password.length === 0 || password.length > 256) return false;
  const expected = Buffer.from(hash, "base64url");
  const got = scryptSync(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: 128 * 1024 * 1024 });
  return same(got, expected);
}

const sign = (payload) => createHmac("sha256", SECRET).update(payload).digest("base64url");

export function makeSession() {
  const payload = `${Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600}.${randomBytes(12).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export function validSession(cookieHeader) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(cookieHeader ?? "");
  if (!m) return false;
  const parts = m[1].split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  if (!same(Buffer.from(sign(payload)), Buffer.from(parts[2]))) return false;
  return Number(parts[0]) > Date.now() / 1000;
}

// Giới hạn toàn cục (sau NAT của Docker mọi IP trông giống nhau): 5 lần sai liên tiếp thì khóa lũy tiến.
let failures = 0;
let lockedUntil = 0;
export const lockRemaining = () => Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
export function recordLogin(success) {
  if (success) {
    failures = 0;
    return;
  }
  failures++;
  if (failures >= 5) lockedUntil = Date.now() + Math.min(900, 30 * 2 ** (failures - 5)) * 1000;
}
