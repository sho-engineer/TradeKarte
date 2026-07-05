"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fileToResizedJpegDataUrl,
  MAIN_IMAGE_MAX_EDGE,
  THUMB_MAX_EDGE,
} from "@/lib/image";
import type { Review, ReviewResponseBody } from "@/lib/review/types";
import { VERDICT_META } from "@/lib/review/verdict";
import KarteCard from "./KarteCard";

const PAIRS = ["", "USD/JPY", "EUR/USD", "GBP/JPY", "EUR/JPY", "AUD/JPY", "GBP/USD", "XAU/USD", "その他"];
const DIRECTIONS = ["", "ロング", "ショート"];
const RESULTS = ["", "勝ち", "負け", "建値", "未確定"];
const MEMO_MAX = 2000;

interface Result {
  review: Review;
  warnings: string[];
  karteId: string | null;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ReviewForm() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [pair, setPair] = useState("");
  const [direction, setDirection] = useState("");
  const [result, setResult] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [karte, setKarte] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const acceptFile = useCallback((f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("画像ファイルを選択してください。");
      return;
    }
    setError(null);
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }, []);

  const clearFile = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // 結果生成/ローディング開始時に結果ブロックへスクロール
  useEffect(() => {
    if ((karte || loading) && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [karte, loading]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    setKarte(null);
    try {
      const [image, thumb] = await Promise.all([
        fileToResizedJpegDataUrl(file, MAIN_IMAGE_MAX_EDGE),
        fileToResizedJpegDataUrl(file, THUMB_MAX_EDGE, 0.8),
      ]);
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, thumb, memo, pair, direction, result }),
      });
      const data = (await res.json()) as ReviewResponseBody & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "レビューに失敗しました。");
        return;
      }
      setKarte({
        review: data.review,
        warnings: data.warnings,
        karteId: data.karteId,
      });
    } catch {
      setError("通信に失敗しました。時間をおいて再試行してください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={submit} className="space-y-5">
        {/* ドロップゾーン */}
        <div>
          <div
            role="button"
            tabIndex={0}
            aria-label="チャート画像を選択"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              acceptFile(e.dataTransfer.files?.[0]);
            }}
            className={`group relative flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
              dragging
                ? "border-accent bg-accent/10"
                : "border-line bg-panel hover:border-line-strong"
            }`}
          >
            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="選択したチャート"
                  className="max-h-72 rounded-lg"
                />
                <button
                  type="button"
                  aria-label="画像をクリア"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-bg/80 text-muted backdrop-blur transition-colors hover:border-impulse hover:text-impulse"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mb-2 h-9 w-9 text-muted transition-colors group-hover:text-accent"
                  aria-hidden
                >
                  <path
                    d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L21 14M4 20h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2zM10 9a1 1 0 11-2 0 1 1 0 012 0z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-sm font-medium text-ink">
                  チャート画像をドラッグ&ドロップ
                </p>
                <p className="mt-1 text-xs text-muted">
                  またはタップして選択（JPEG / PNG / WebP）
                </p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />
          </div>
          {file && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-line bg-panel px-3 py-2">
              <span className="truncate font-mono text-xs text-ink/80">
                {file.name}
                <span className="ml-2 text-muted">{formatBytes(file.size)}</span>
              </span>
              <button
                type="button"
                onClick={clearFile}
                className="shrink-0 font-mono text-xs text-muted hover:text-impulse"
              >
                クリア
              </button>
            </div>
          )}
        </div>

        {/* メモ */}
        <div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            maxLength={MEMO_MAX}
            placeholder="状況メモ（例: 東京時間のレンジ上抜けを見てロング。直前に2連敗していて取り返したい気持ちがあった…）"
            className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm placeholder:text-muted/60 focus:border-accent focus:outline-none"
          />
          <div className="mt-1 text-right font-mono text-[11px] text-muted">
            {memo.length} / {MEMO_MAX}
          </div>
        </div>

        {/* メタ */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-muted">
              通貨ペア
            </span>
            <select
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {PAIRS.map((p) => (
                <option key={p} value={p}>
                  {p === "" ? "選択しない" : p}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-muted">
              方向
            </span>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === "" ? "選択しない" : d}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted">
              結果
              <span className="rounded bg-panel-2 px-1 py-0.5 text-[9px] normal-case tracking-normal text-muted/80">
                判定に影響しない
              </span>
            </span>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {RESULTS.map((r) => (
                <option key={r} value={r}>
                  {r === "" ? "選択しない" : r}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p
            aria-live="assertive"
            className="rounded-lg border border-impulse/40 bg-impulse/10 px-4 py-3 text-sm text-impulse"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!file || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <>
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 animate-spin"
                fill="none"
                aria-hidden
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M21 12a9 9 0 00-9-9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              AIがカルテを作成中…
            </>
          ) : (
            "レビューを依頼する"
          )}
        </button>
      </form>

      <div ref={resultRef}>
        {loading && <KarteSkeleton />}

        {!loading && karte && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
                Karte
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <KarteCard review={karte.review} warnings={karte.warnings} />
            {karte.karteId ? (
              <Link
                href={`/app/karte/${karte.karteId}`}
                className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
              >
                履歴で詳しく見る →
              </Link>
            ) : (
              <p className="text-xs text-muted">
                ※ ログインしていないため、このカルテは保存されていません。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KarteSkeleton() {
  const rails = Object.values(VERDICT_META).map((m) => m.border);
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="overflow-hidden rounded-xl border border-line-strong bg-panel"
    >
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <div className="skeleton h-14 w-14 rounded-lg" />
        <div className="space-y-2">
          <div className="skeleton h-3.5 w-24 rounded" />
          <div className="skeleton h-2.5 w-40 rounded" />
        </div>
      </div>
      <div className="space-y-3 px-5 py-5">
        <div className="skeleton h-16 w-full rounded-lg" />
        {rails.map((border, i) => (
          <div
            key={i}
            className={`rounded-lg border-l-2 ${border} bg-panel-2/40 py-3 pl-4 pr-3`}
          >
            <div className="skeleton mb-2 h-3 w-28 rounded" />
            <div className="skeleton h-2.5 w-full rounded" />
            <div className="skeleton mt-1.5 h-2.5 w-4/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
