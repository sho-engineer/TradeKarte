"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type State = "loading" | "ready" | "error" | "unconfigured";

/**
 * Supabase Anonymous Sign-In(§2.2)。
 * - メール入力なしで匿名ユーザーを作成し、セッションを復元する
 * - user_id はセッション由来のみ。リクエスト本文へ載せない
 */
export default function AnonGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("loading");

  // 初期stateが "loading" なので、effect内では非同期完了後にのみsetStateする
  const ensureSession = useCallback(async (): Promise<State> => {
    if (!isSupabaseConfigured()) return "unconfigured";
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) return "ready";
    const { error } = await supabase.auth.signInAnonymously();
    return error ? "error" : "ready";
  }, []);

  useEffect(() => {
    let cancelled = false;
    ensureSession().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [ensureSession]);

  if (state === "unconfigured") {
    return (
      <div className="tk-page">
        <div className="tk-page__col tk-card p-6">
          <p className="text-sm leading-relaxed text-muted">
            Supabase が未設定です。環境変数
            NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
            を設定してください。
          </p>
        </div>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="tk-page">
        <div className="tk-page__col tk-card p-6">
          <p className="font-mono text-xs tracking-widest text-muted">
            匿名セッションを準備中…
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="tk-page">
        <div className="tk-page__col tk-card p-6 space-y-4">
          <p className="text-sm leading-relaxed text-impulse">
            匿名サインインに失敗しました。Supabase の Anonymous Sign-In
            が有効か確認のうえ、再試行してください。
          </p>
          <button
            type="button"
            onClick={() => {
              setState("loading");
              void ensureSession().then(setState);
            }}
            className="border border-line px-4 py-2 text-sm hover:border-accent"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <p className="mx-auto mt-8 max-w-2xl px-6 pb-8 font-mono text-[11px] leading-relaxed text-muted">
        このアプリはメール登録なしの匿名アカウントで動作しています。ブラウザのデータ(Cookie・サイトデータ)を削除すると、記録へ再アクセスできなくなる可能性があります。
      </p>
    </>
  );
}
