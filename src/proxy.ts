import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/p0/accessCookie";

// /app 配下はアクセスコードCookieが必須(機能設計書 v3.3 §2.1)。
// Cookieがない・署名不正・期限切れは /access へ。
// /api/review 側は Route Handler 自身でも検証する(両方で検証)。
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/app")) {
    const secret = process.env.APP_ACCESS_COOKIE_SECRET ?? "";
    const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
    const ok = await verifyAccessToken(secret, token);
    if (!ok) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/access";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Supabaseセッションのリフレッシュ(匿名セッションの復元)。
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // createServerClient と getUser の間に他の処理を挟まないこと。
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: ["/app/:path*"],
};
