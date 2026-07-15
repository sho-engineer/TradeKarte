import type { Metadata } from "next";
import Link from "next/link";
import Mark from "@/components/brand/Mark";
import Wordmark from "@/components/brand/Wordmark";
import ThemeToggle from "@/components/ThemeToggle";
import { isVerdict } from "@/lib/review/types";
import { verdictMeta } from "@/lib/review/verdict";

// 公開ページ(認証不要)。描画物はすべて URL クエリ由来 = PIIなし。
// メモ・pnl・残高・氏名・チャート画像は一切扱わない(構造的に匿名)。

function readVerdict(sp: Record<string, string | string[] | undefined>): string | null {
  const v = sp.v;
  const value = Array.isArray(v) ? v[0] : v;
  return isVerdict(value) ? value : null;
}

function readPair(sp: Record<string, string | string[] | undefined>): string | null {
  const p = sp.pair;
  const value = Array.isArray(p) ? p[0] : p;
  if (!value) return null;
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9/]/g, "").slice(0, 12);
  return cleaned || null;
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/share">): Promise<Metadata> {
  const sp = await searchParams;
  const verdict = readVerdict(sp);
  const pair = readPair(sp);

  // og画像URLは検証済みの安全項目のみで構築
  const ogParams = new URLSearchParams();
  if (verdict) ogParams.set("v", verdict);
  if (pair) ogParams.set("pair", pair);
  const ogUrl = `/api/og?${ogParams.toString()}`;

  const title = verdict
    ? `判定「${verdict}」｜ポジミル`
    : "ポジミル｜そのポジは、エッジか衝動か。";

  return {
    title,
    description:
      "チャート画像と一言メモから、AIが売買の意思決定の質を批評するFXトレーダー向け振り返りツール。売買シグナルは出しません。",
    openGraph: {
      title,
      description: "そのポジは、エッジか衝動か。",
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: "そのポジは、エッジか衝動か。",
      images: [ogUrl],
    },
  };
}

export default async function SharePage({ searchParams }: PageProps<"/share">) {
  const sp = await searchParams;
  const verdict = readVerdict(sp);
  const meta = verdict ? verdictMeta(verdict) : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Mark size={28} />
          <span className="font-mono text-lg font-bold text-ink">
            <Wordmark />
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <section className="mt-16 space-y-8">
        {verdict && meta ? (
          <div className="border border-line bg-panel p-8">
            <p className="font-mono text-xs tracking-widest text-muted">
              AI TRADE REVIEW / 判定結果
            </p>
            <div className="mt-5 flex items-center gap-4">
              <span
                className="inline-flex items-center rounded-full border px-4 py-1.5 font-mono text-xs tracking-widest"
                style={{ borderColor: meta.color, color: meta.color }}
              >
                {meta.en}
              </span>
              <span className="text-3xl font-bold" style={{ color: "var(--tk-text)" }}>
                {verdict}
              </span>
            </div>
            <p className="mt-4 leading-relaxed text-muted">{meta.headline}</p>
          </div>
        ) : (
          <div className="border border-line bg-panel p-8">
            <h1 className="text-2xl font-bold leading-snug">
              そのポジは、<span className="text-accent">エッジ</span>か
              <span className="text-impulse">衝動</span>か。
            </h1>
            <p className="mt-4 leading-relaxed text-muted">
              チャート画像と一言メモを投げるだけ。AIが売買の「意思決定の質」を批評します。
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href="/app"
            className="bg-accent px-6 py-3 font-semibold text-bg hover:opacity-90"
          >
            自分のトレードを診断する
          </Link>
          <Link
            href="/"
            className="border border-line px-6 py-3 text-sm leading-6 hover:border-accent"
          >
            ポジミルとは
          </Link>
        </div>

        <p className="text-xs leading-relaxed text-muted">
          このページは判定と通貨ペアのみを共有しています。損益・残高・メモ・チャート画像は含まれません。
        </p>
      </section>
    </main>
  );
}
