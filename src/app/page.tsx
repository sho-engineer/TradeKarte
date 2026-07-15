import Link from "next/link";
import Mark from "@/components/brand/Mark";
import Wordmark from "@/components/brand/Wordmark";
import ThemeToggle from "@/components/ThemeToggle";

const FEATURES = [
  {
    title: "AIは、結果を知らない",
    body: "チャートはエントリー地点でクロップしてから送信。損益・決済結果・エントリー後の値動きはAIに一切渡りません。勝ったのに、怒られることがあります。",
  },
  {
    title: "自分のルールと照合",
    body: "事前に登録したプレイブック（必須条件・見送り条件・無効化基準）と、実際の行動が沿っていたかを1条件ずつ監査します。",
  },
  {
    title: "事実と推測を分ける",
    body: "画像や文章から確認できた事実と、そこから推測される行動兆候を分けて提示。根拠の出所も明記します。判定はあなたが訂正できます。",
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
            href="/app"
            className="border border-line px-4 py-2 text-sm hover:border-accent"
          >
            はじめる
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
        <p className="font-semibold text-ink">AIは、結果を知らない。</p>
        <p className="max-w-xl leading-relaxed text-muted">
          AIが見るのは、エントリー地点までのチャートと、あなたが事前に決めたルール、そしてエントリー理由だけ。結果を知らないAIが「判断の質」を監査します。売買シグナルも、将来予測も出しません。
        </p>
        <div className="flex gap-3">
          <Link
            href="/app"
            className="bg-accent px-6 py-3 font-semibold text-bg hover:opacity-90"
          >
            はじめる
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
      </footer>
    </main>
  );
}
