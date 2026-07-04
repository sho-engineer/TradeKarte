import Link from "next/link";

const FREE_LIMIT = process.env.FREE_MONTHLY_LIMIT ?? "10";
const CHECKOUT_URL = process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL;

export default function UpgradePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Link href="/app" className="text-sm text-muted hover:text-ink">
        ← アプリに戻る
      </Link>
      <h1 className="mt-6 text-2xl font-bold">プラン</h1>
      <p className="mt-2 text-sm text-muted">
        まずは無料で。振り返りが習慣になったら Pro へ。
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-6">
          <h2 className="font-mono text-sm tracking-wider text-muted">FREE</h2>
          <p className="mt-2 text-3xl font-bold">
            ¥0
            <span className="ml-1 text-sm font-normal text-muted">/月</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>・AIレビュー 月{FREE_LIMIT}回まで</li>
            <li>・カルテ履歴の保存</li>
            <li>・パターン検出（直近30日）</li>
          </ul>
        </div>

        <div className="rounded-xl border border-accent/50 bg-panel p-6">
          <h2 className="font-mono text-sm tracking-wider text-accent">PRO</h2>
          <p className="mt-2 text-3xl font-bold">
            ¥980
            <span className="ml-1 text-sm font-normal text-muted">
              /月（予定）
            </span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>・AIレビュー 無制限</li>
            <li>・カルテ履歴の保存</li>
            <li>・パターン検出（直近30日）</li>
          </ul>
          {CHECKOUT_URL ? (
            <a
              href={CHECKOUT_URL}
              className="mt-6 block rounded-xl bg-accent px-4 py-3 text-center font-semibold text-bg hover:opacity-90"
            >
              Pro にアップグレード
            </a>
          ) : (
            <button
              disabled
              className="mt-6 w-full cursor-not-allowed rounded-xl bg-accent/30 px-4 py-3 font-semibold text-bg/70"
            >
              準備中
            </button>
          )}
        </div>
      </div>

      <p className="mt-8 text-xs text-muted">
        ※ 価格・提供内容は正式リリース時に変更になる場合があります。
      </p>
    </main>
  );
}
