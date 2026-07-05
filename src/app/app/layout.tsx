import Link from "next/link";
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
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3">
          <nav className="flex items-center gap-4 sm:gap-5">
            <Link href="/" className="font-mono font-bold text-accent">
              TradeKarte
            </Link>
            <Link
              href="/app"
              className="whitespace-nowrap text-sm text-muted hover:text-ink"
            >
              新規カルテ
            </Link>
            <Link
              href="/app/history"
              className="whitespace-nowrap text-sm text-muted hover:text-ink"
            >
              履歴
            </Link>
            <Link
              href="/upgrade"
              className="whitespace-nowrap text-sm text-muted hover:text-ink"
            >
              プラン
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {email ? (
              <>
                <span className="hidden font-mono text-xs text-muted sm:inline">
                  {email}
                </span>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-ink"
                  >
                    ログアウト
                  </button>
                </form>
              </>
            ) : (
              <span className="font-mono text-xs text-mixed">
                お試しモード
                <span className="hidden sm:inline">（保存されません）</span>
              </span>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
