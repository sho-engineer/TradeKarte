import Link from "next/link";
import AppNav from "@/components/AppNav";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let email: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="tk-topbar">
        <div className="tk-topbar__inner">
          <Link href="/" className="tk-topbar__brand">
            TRADEKARTE
          </Link>
          <AppNav />
          <div className="tk-topbar__meta">
            {email ? (
              <>
                <span className="tk-only-desktop-inline">{email}</span>
                <form action="/auth/signout" method="post">
                  <button type="submit" className="tk-topbar__signout">
                    ログアウト
                  </button>
                </form>
              </>
            ) : (
              <span>お試しモード · 保存なし</span>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
