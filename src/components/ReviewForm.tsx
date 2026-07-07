"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatJst } from "@/lib/db";
import {
  fileToResizedJpegDataUrl,
  MAIN_IMAGE_MAX_EDGE,
  THUMB_MAX_EDGE,
} from "@/lib/image";
import {
  EMOTIONS,
  type Review,
  type ReviewResponseBody,
} from "@/lib/review/types";
import KarteCard from "./KarteCard";

const PAIRS = ["USD/JPY", "EUR/USD", "GBP/JPY", "EUR/JPY", "AUD/JPY", "GBP/USD", "XAU/USD", "その他"];
const DIRECTIONS = ["ロング", "ショート"];
const RESULTS = ["勝ち", "負け", "建値", "未確定"];
const MEMO_MAX = 2000;

interface Result {
  review: Review;
  warnings: string[];
  karteId: string | null;
  createdAt: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fileKind(file: File): string {
  return (file.type.split("/")[1] ?? "img").toUpperCase();
}

export default function ReviewForm() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [emotion, setEmotion] = useState("");
  const [pair, setPair] = useState("");
  const [direction, setDirection] = useState("");
  const [result, setResult] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [karte, setKarte] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // 受付番号は表示用(日時ベース)。SSRとクライアントで秒差が出うるので
  // 表示側で suppressHydrationWarning を付ける
  const intakeNo = useMemo(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `PJ-${d.getFullYear()}-${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }, []);

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
        body: JSON.stringify({
          image,
          thumb,
          memo,
          pair,
          direction,
          result,
          emotion_pre: emotion || undefined,
        }),
      });
      const data = (await res.json()) as ReviewResponseBody & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "診断に失敗しました。");
        return;
      }
      setKarte({
        review: data.review,
        warnings: data.warnings,
        karteId: data.karteId,
        createdAt:
          formatJst(new Date().toISOString()).replaceAll("/", ".") + " JST",
      });
    } catch {
      setError("通信に失敗しました。時間をおいて再試行してください。");
    } finally {
      setLoading(false);
    }
  }

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      acceptFile(e.dataTransfer.files?.[0]);
    },
  };

  return (
    <div className="space-y-10">
      <form onSubmit={submit} className="tk-card">
        {/* masthead */}
        <div className="tk-input__masthead">
          <div>
            <div className="tk-input__title">新規カルテ受付</div>
            <div className="tk-input__subtitle">NEW RECORD · INTAKE</div>
          </div>
          <span className="tk-input__no" suppressHydrationWarning>
            No. {intakeNo}
          </span>
        </div>

        {/* specimen dropzone */}
        <div className="tk-input__block">
          <div className="tk-input__label tk-input__label--accent">
            検体添付欄 / CHART
          </div>
          {file && previewUrl ? (
            <div
              className={
                "tk-input__dropzone" +
                (dragging ? " tk-input__dropzone--drag" : "")
              }
              {...dropHandlers}
            >
              <div className="tk-input__dropzone-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="選択したチャート"
                  className="tk-input__thumb"
                />
                <div className="tk-input__file-info">
                  <div className="tk-input__filename">{file.name}</div>
                  <div className="tk-input__filemeta">
                    {fileKind(file)} · {formatBytes(file.size)}
                  </div>
                </div>
                <div className="tk-input__dropzone-actions">
                  <button
                    type="button"
                    className="tk-btn tk-btn--ghost"
                    onClick={() => inputRef.current?.click()}
                  >
                    差し替え
                  </button>
                  <button
                    type="button"
                    className="tk-btn tk-btn--danger-ghost"
                    onClick={clearFile}
                  >
                    クリア
                  </button>
                </div>
              </div>
              <div className="tk-input__dropzone-note">
                画像は診断と履歴サムネイルの生成にのみ使用します。
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-label="チャート画像を選択"
              className={
                "tk-input__dropzone tk-input__dropzone--empty" +
                (dragging ? " tk-input__dropzone--drag" : "")
              }
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              {...dropHandlers}
            >
              <div className="tk-input__dropzone-cta">
                チャート画像をここへ — ドラッグ&ドロップ / タップで選択
              </div>
              <div className="tk-input__dropzone-sub">
                JPEG · PNG · WEBP
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />
        </div>

        {/* memo */}
        <div className="tk-input__block">
          <div className="tk-input__memo-head">
            <span className="tk-input__label">状況メモ / NOTE</span>
            <span className="tk-input__counter">
              {memo.length} / {MEMO_MAX}
            </span>
          </div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            maxLength={MEMO_MAX}
            placeholder="例: ずっと見てた高値をやっと抜けた。乗り遅れたくなくて成行で入った。"
            className="tk-textarea"
          />
        </div>

        {/* F1: エントリー前の自己申告感情 */}
        <div className="tk-input__block">
          <div className="tk-input__label">
            エントリー前の感情 / STATE{" "}
            <span className="tk-input__label-note">
              — 任意・もう一度タップで解除
            </span>
          </div>
          <div
            className="tk-input__pillrow"
            role="group"
            aria-label="エントリー前の感情"
          >
            {EMOTIONS.map(({ value, emoji }) => {
              const selected = emotion === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setEmotion(selected ? "" : value)}
                  className={"tk-pill" + (selected ? " tk-pill--active" : "")}
                >
                  <span aria-hidden>{emoji}</span> {value}
                </button>
              );
            })}
          </div>
        </div>

        {/* optional fields */}
        <div className="tk-input__block">
          <div className="tk-input__label">
            任意項目{" "}
            <span className="tk-input__label-note">— 判定には影響しません</span>
          </div>
          <div className="tk-input__optgrid">
            <div className="tk-input__optcell">
              <div className="tk-input__optlabel">通貨ペア</div>
              <div className="tk-select-wrap">
                <select
                  value={pair}
                  onChange={(e) => setPair(e.target.value)}
                  className="tk-select"
                  aria-label="通貨ペア"
                >
                  <option value="">—</option>
                  {PAIRS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="tk-input__optcell">
              <div className="tk-input__optlabel">方向</div>
              <div className="tk-input__pillrow" role="group" aria-label="方向">
                {DIRECTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={direction === d}
                    onClick={() => setDirection(direction === d ? "" : d)}
                    className={
                      "tk-pill" + (direction === d ? " tk-pill--active" : "")
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="tk-input__optcell">
              <div className="tk-input__optlabel">結果</div>
              <div className="tk-input__pillrow" role="group" aria-label="結果">
                {RESULTS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={result === r}
                    onClick={() => setResult(result === r ? "" : r)}
                    className={
                      "tk-pill" + (result === r ? " tk-pill--active" : "")
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p aria-live="assertive" className="tk-input__error">
            {error}
          </p>
        )}

        {/* submit */}
        <div className="tk-input__submit">
          <button
            type="submit"
            disabled={!file || loading}
            className="tk-btn tk-btn--primary"
          >
            {loading ? "診断中…" : "診断を依頼する"}
          </button>
          <span className="tk-input__submit-note">
            過去の売買の振り返り専用。
            <br />
            将来の売買シグナル・価格予測は提供しません。
          </span>
        </div>
      </form>

      <div ref={resultRef}>
        {loading && <KarteTypesetting />}

        {!loading && karte && (
          <div className="space-y-4">
            <KarteCard
              review={karte.review}
              warnings={karte.warnings}
              meta={{
                createdAt: karte.createdAt,
                pair: pair || null,
                direction: direction || null,
                result: result || null,
                emotionPre: emotion || null,
                memo: memo || null,
                thumbUrl: previewUrl,
              }}
            />
            {karte.karteId ? (
              <Link
                href={`/app/karte/${karte.karteId}`}
                className="tk-btn tk-btn--ghost inline-block no-underline"
              >
                台帳でこのカルテを見る →
              </Link>
            ) : (
              <p className="tk-input__submit-note">
                ※ ログインしていないため、このカルテは保存されていません。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 診断待ちの「組版中」スケルトン(通常10〜20秒) */
function KarteTypesetting() {
  const rows = [
    { n: "01", delay: "0.1s" },
    { n: "02", delay: "0.35s" },
    { n: "03", delay: "0.6s" },
  ];
  return (
    <div className="tk-loading tk-card" aria-live="polite" aria-busy="true">
      <div className="tk-loading__head">
        <span className="tk-loading__title">診断カルテ</span>
        <span className="tk-loading__status">● 組版中</span>
      </div>
      <div className="tk-loading__body">
        <div className="tk-skel tk-loading__chart-skel" />
        <div className="tk-loading__verdict-skel">
          <div className="tk-skel tk-loading__stamp-skel" />
          <div className="tk-loading__verdict-lines">
            <div
              className="tk-skel"
              style={{ height: 14, width: "60%", marginBottom: 12 }}
            />
            <div
              className="tk-skel"
              style={{ height: 20, width: "100%", marginBottom: 8 }}
            />
            <div className="tk-skel" style={{ height: 20, width: "80%" }} />
          </div>
        </div>
        <div className="tk-loading__sections">
          {rows.map((row) => (
            <div className="tk-loading__section-row" key={row.n}>
              <div className="tk-loading__section-head">
                <span className="tk-loading__section-n">{row.n}</span>
                <span
                  className="tk-loading__ink-rule"
                  style={{ animationDelay: row.delay }}
                />
              </div>
              <div
                className="tk-skel"
                style={{ height: 12, width: "92%", marginBottom: 6 }}
              />
              <div className="tk-skel" style={{ height: 12, width: "70%" }} />
            </div>
          ))}
        </div>
      </div>
      <div className="tk-loading__footer">
        <div className="tk-loading__footer-line">
          意思決定の質を診ています…
        </div>
        <div className="tk-loading__footer-sub">
          通常 10〜20 秒 · 損益ではなく判断を評価
        </div>
      </div>
    </div>
  );
}
