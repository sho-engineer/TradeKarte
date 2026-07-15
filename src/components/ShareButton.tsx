"use client";

import { useState } from "react";

// 匿名 by design: verdict と(あれば)通貨ペアだけで共有URLを組み立てる。
// 損益・残高・メモ・チャート画像は一切含めない。
export default function ShareButton({
  verdict,
  pair,
}: {
  verdict: string;
  pair?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  function buildShareUrl(): string {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams({ v: verdict });
    if (pair) {
      const cleaned = pair
        .toUpperCase()
        .replace(/[^A-Z0-9/]/g, "")
        .slice(0, 12);
      if (cleaned) params.set("pair", cleaned);
    }
    return `${origin}/share?${params.toString()}`;
  }

  function shareToX() {
    const url = buildShareUrl();
    const text = `そのポジは、エッジか衝動か。判定は「${verdict}」でした。`;
    const intent =
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}` +
      `&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(buildShareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* クリップボード不可の環境では何もしない */
    }
  }

  return (
    <div className="tk-share">
      <span className="tk-share__label">この判定を共有</span>
      <div className="tk-share__actions">
        <button type="button" onClick={shareToX} className="tk-share__btn">
          Xでシェア
        </button>
        <button type="button" onClick={copyLink} className="tk-share__btn">
          {copied ? "コピーしました" : "リンクをコピー"}
        </button>
      </div>
      <span className="tk-share__note">
        共有されるのは判定と通貨ペアのみ。損益・メモ・画像は含まれません。
      </span>
    </div>
  );
}
