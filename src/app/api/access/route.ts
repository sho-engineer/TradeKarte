import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  accessCookieOptions,
  issueAccessToken,
  verifyAccessCode,
} from "@/lib/p0/accessCookie";

export const runtime = "nodejs";

// アクセスコードを検証し、署名済みHttpOnly Cookieを発行する(§2.1)。
// 失敗時はCookieを発行しない(ACCESS-002)。
export async function POST(request: NextRequest) {
  const expectedCode = process.env.APP_ACCESS_CODE;
  const secret = process.env.APP_ACCESS_COOKIE_SECRET;
  if (!expectedCode || !secret) {
    return NextResponse.json(
      { error: "アクセスコードが未設定です" },
      { status: 503 },
    );
  }

  let code: unknown;
  try {
    const body = await request.json();
    code = body?.code;
  } catch {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }
  if (typeof code !== "string" || code.length === 0 || code.length > 200) {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  const ok = await verifyAccessCode(code, expectedCode);
  if (!ok) {
    return NextResponse.json(
      { error: "アクセスコードが違います" },
      { status: 401 },
    );
  }

  const token = await issueAccessToken(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE_NAME, token, accessCookieOptions());
  return res;
}
