import Link from "next/link";
import Mark from "@/components/brand/Mark";
import Wordmark from "@/components/brand/Wordmark";
import ThemeToggle from "@/components/ThemeToggle";

const FEATURES = [
  {
    title: "判定は損益と独立",
    body: "勝ち負けではなく、エントリー時点で見えていた情報だけで「エッジ／衝動／混在」を判定。勝ったのに衝動、負けたのにエッジ、が正しく可視化されます。",
  },
  {
    title: "コーチと批判者の2視点",
    body: "根拠の妥当性を認める「所見」と、バイアスや見落としを突く「指摘」。耳が痛い部分まで含めて1枚のカルテに。",
  },
  {
    title: "繰り返す癖を検出",
    body: "カルテはタグ付きで蓄積。同じ失敗パターン（FOMO・リベンジ等）が直近30日で繰り返されると警告します。",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Mark size={28} />
          <span className="font-mono text-lg font-bold text-ink">
            <Wordmark />
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="border border-line px-4 py-2 text-sm hover:border-accent"
          >
            ログイン
          </Link>
        </div>
      </header>

      <section className="mt-20 space-y-6">
        <p className="font-mono text-xs tracking-widest text-muted">
          AI TRADE REVIEW / 裁量FXトレーダー向け
        </p>
        <h1 className="text-3xl font-bold leading-snug tracking-wide sm:text-4xl">
          そのポジは、
          <br />
          <span className="text-accent">エッジ</span>か
          <span className="text-impulse">衝動</span>か。
        </h1>
        <p className="max-w-xl leading-relaxed text-muted">
          チャート画像と一言メモを投げるだけ。AIがあなたの売買の
          「意思決定の質」を批評し、カルテとして記録します。
          集計アプリでも、シグナル配信でもありません。
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="bg-accent px-6 py-3 font-semibold text-bg hover:opacity-90"
          >
            無料で始める
          </Link>
          <Link
            href="/app"
            className="border border-line px-6 py-3 text-sm leading-6 hover:border-accent"
          >
            まず試す
          </Link>
        </div>
      </section>

      <section className="mt-20 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="border border-line bg-panel p-5"
          >
            <h2 className="mb-2 font-semibold text-accent">{f.title}</h2>
            <p className="text-sm leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-20 border-t border-line pt-6 text-xs leading-relaxed text-muted">
        <p>
          ポジミル
          は過去のトレードの振り返りを支援するツールです。将来の値動きの予測、売買の推奨・助言は一切行いません。投資判断はご自身の責任で行ってください。
        </p>
        <nav className="mt-4 flex flex-wrap gap-4 font-mono">
          <Link href="/legal/terms" className="hover:text-accent">
            利用規約
          </Link>
          <Link href="/legal/privacy" className="hover:text-accent">
            プライバシー
          </Link>
          <Link href="/legal/tokushoho" className="hover:text-accent">
            特定商取引法
          </Link>
        </nav>
      </footer>
    </main>
  );
}
