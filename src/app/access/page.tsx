"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Mark from "@/components/brand/Mark";
import Wordmark from "@/components/brand/Wordmark";
import ThemeToggle from "@/components/ThemeToggle";

// アクセスコード入力(§2.1)。成功すると署名済みHttpOnly Cookieが
// サーバー側で発行され、/app へ入れる。コード自体はCookieへ入らない。
export default function AccessPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/app");
      router.refresh();
    } else if (res.status === 401) {
      setError("アクセスコードが違います。");
    } else {
      setError("送信に失敗しました。時間をおいてお試しください。");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="mb-8 flex items-center justify-center gap-2 font-mono text-lg font-bold text-ink">
        <Mark size={22} />
        <Wordmark />
      </div>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          ポジミルは現在、限定公開中です。共有されたアクセスコードを入力してください。
        </p>
        <input
          type="password"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="アクセスコード"
          autoComplete="off"
          className="w-full border border-line bg-panel px-4 py-3 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || code.length === 0}
          className="w-full bg-accent px-4 py-3 font-semibold text-bg hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "確認中…" : "入室する"}
        </button>
        {error && <p className="text-sm text-impulse">{error}</p>}
      </form>
    </main>
  );
}
