"use client";

import { useCallback, useRef, useState } from "react";
import {
  fileToResizedJpegDataUrl,
  MAIN_IMAGE_MAX_EDGE,
  THUMB_MAX_EDGE,
} from "@/lib/image";
import type { Review, ReviewResponseBody } from "@/lib/review/types";
import KarteCard from "./KarteCard";

const PAIRS = ["", "USD/JPY", "EUR/USD", "GBP/JPY", "EUR/JPY", "AUD/JPY", "GBP/USD", "XAU/USD", "その他"];
const DIRECTIONS = ["", "ロング", "ショート"];
const RESULTS = ["", "勝ち", "負け", "建値", "未確定"];

interface Result {
  review: Review;
  warnings: string[];
  karteId: string | null;
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
      <form onSubmit={submit} className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
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
          className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
            dragging
              ? "border-accent bg-accent/5"
              : "border-line bg-panel hover:border-muted"
          }`}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="選択したチャート"
              className="max-h-72 rounded-lg"
            />
          ) : (
            <>
              <p className="text-sm text-ink">
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

        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="状況メモ（例: 東京時間のレンジ上抜けを見てロング。直前に2連敗していて取り返したい気持ちがあった…）"
          className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block font-mono text-xs text-muted">
              通貨ペア（任意）
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
            <span className="mb-1 block font-mono text-xs text-muted">
              方向（任意）
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
            <span className="mb-1 block font-mono text-xs text-muted">
              結果（任意・判定には影響しません）
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
          <p className="rounded-lg border border-impulse/40 bg-impulse/10 px-4 py-3 text-sm text-impulse">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!file || loading}
          className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "AIがカルテを作成中…" : "レビューを依頼する"}
        </button>
      </form>

      {karte && (
        <div className="space-y-2">
          <h2 className="font-mono text-xs tracking-wider text-muted">
            KARTE
          </h2>
          <KarteCard review={karte.review} warnings={karte.warnings} />
          {karte.karteId === null && (
            <p className="text-xs text-muted">
              ※ ログインしていないため、このカルテは保存されていません。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
