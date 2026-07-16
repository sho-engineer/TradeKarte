// アクセスコード方式の署名済みCookie(機能設計書 v3.3 §2.1)。
// - Cookieにはアクセスコード平文を入れない(ACCESS-005)
// - HMAC-SHA256(APP_ACCESS_COOKIE_SECRET)で有効期限を署名
// - proxy(エッジ)とRoute Handler(Node)の両方で動くよう Web Crypto のみ使用

export const ACCESS_COOKIE_NAME = "pojimiru_access";

/** Cookieの有効期間(秒)。Phase 0Aは限定共有のため30日 */
export const ACCESS_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

const TOKEN_VERSION = "v1";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return new Uint8Array(sig);
}

async function sha256(message: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(message),
  );
  return new Uint8Array(digest);
}

/**
 * 定数時間比較。まず両辺をSHA-256で固定長にし、XOR集約で比較する
 * (長さ差・内容差による早期returnを避ける)。
 */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da[i] ^ db[i];
  return diff === 0;
}

/** アクセスコード本体の照合(定数時間) */
export async function verifyAccessCode(
  input: string,
  expected: string,
): Promise<boolean> {
  if (!expected) return false;
  return constantTimeEqual(input, expected);
}

function signaturePayload(expiresEpochSec: number): string {
  return `${TOKEN_VERSION}:pojimiru-access:${expiresEpochSec}`;
}

/** 署名済みトークンを発行する。形式: v1.<expiresEpochSec>.<base64url(HMAC)> */
export async function issueAccessToken(
  secret: string,
  nowMs: number = Date.now(),
  ttlSeconds: number = ACCESS_COOKIE_TTL_SECONDS,
): Promise<string> {
  const expires = Math.floor(nowMs / 1000) + ttlSeconds;
  const sig = await hmacSha256(secret, signaturePayload(expires));
  return `${TOKEN_VERSION}.${expires}.${toBase64Url(sig)}`;
}

/**
 * トークン検証。署名不正・形式不正・期限切れは false。
 * 署名比較も定数時間で行う。
 */
export async function verifyAccessToken(
  secret: string,
  token: string | undefined | null,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return false;
  const expires = Number(parts[1]);
  if (!Number.isInteger(expires)) return false;
  if (expires <= Math.floor(nowMs / 1000)) return false;
  const expected = toBase64Url(
    await hmacSha256(secret, signaturePayload(expires)),
  );
  return constantTimeEqual(parts[2], expected);
}

/** Set-Cookie 用オプション(HttpOnly / 本番Secure / SameSite=Lax) */
export function accessCookieOptions(nowMs: number = Date.now()) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(nowMs + ACCESS_COOKIE_TTL_SECONDS * 1000),
  };
}
