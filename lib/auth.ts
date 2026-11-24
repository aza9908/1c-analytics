// Общий модуль авторизации — используется и в middleware (edge runtime),
// и в server action /login. Поэтому никаких node: импортов.

export const AUTH_COOKIE = "onec-auth";
export const AUTH_USER = process.env.BASIC_AUTH_USER || "admin";
export const AUTH_PASS = process.env.BASIC_AUTH_PASS || "admin";
const AUTH_SECRET = process.env.AUTH_SECRET || "onec-dev-secret-change-me";
export const AUTH_DISABLED = process.env.BASIC_AUTH_DISABLED === "1";

// HMAC-SHA256 → url-safe base64. Работает в edge (crypto.subtle).
async function hmac(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const bytes = new Uint8Array(sigBuf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Ожидаемый токен для текущих кред. Если поменять ENV — старые куки
// автоматически станут невалидными.
export async function expectedToken(): Promise<string> {
  return hmac(`${AUTH_USER}:${AUTH_PASS}`, AUTH_SECRET);
}

export function credsMatch(user: string, pass: string): boolean {
  return user === AUTH_USER && pass === AUTH_PASS;
}

// Constant-time сравнение (чтобы не утекал тайминг).
export function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
