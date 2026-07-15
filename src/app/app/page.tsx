import AnonGate from "@/components/p0/AnonGate";

// Phase 0A Step 2 時点の最小画面。入力画面(Step 11)は
// レビューAPI+核心テストのチェックポイント確認後に実装する。
export default function AppPage() {
  return (
    <AnonGate>
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="text-xl font-bold">ポジミル(Phase 0A)</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          匿名セッションの準備ができています。レビューは現在 API
          経由で実行できます(入力画面は次のステップで実装)。
        </p>
      </main>
    </AnonGate>
  );
}
