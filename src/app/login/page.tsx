"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Mark from "@/components/brand/Mark";
import Wordmark from "@/components/brand/Wordmark";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      setError(
        "Supabase が未設定です。環境変数を設定するか、ログインなしで /app からお試しください。",
      );
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setError("送信に失敗しました。メールアドレスをご確認ください。");
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="border border-line bg-panel p-6 text-center">
        <p className="font-semibold text-accent">メールを送信しました</p>
        <p className="mt-2 text-sm text-muted">
          {email} 宛のログインリンクを開いてください。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {authError && (
        <p className="border border-impulse/40 bg-impulse/10 px-4 py-3 text-sm text-impulse">
          ログインリンクが無効か期限切れです。もう一度お試しください。
        </p>
      )}
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="メールアドレス"
        className="w-full border border-line bg-panel px-4 py-3 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-accent px-4 py-3 font-semibold text-bg hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "送信中…" : "ログインリンクを送る"}
      </button>
      {error && <p className="text-sm text-impulse">{error}</p>}
      <p className="text-xs text-muted">
        パスワードは不要です。メールに届くリンクからログインします（初回は自動で登録されます）。
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <Link
        href="/"
        className="mb-8 flex items-center justify-center gap-2 font-mono text-lg font-bold text-ink"
      >
        <Mark size={22} />
        <Wordmark />
      </Link>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
