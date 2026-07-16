import AnonGate from "@/components/p0/AnonGate";
import ReviewForm from "@/components/p0/ReviewForm";

// Phase 0A メイン画面: 入力(§4)→AIレビュー→カルテ表示(§11)。
export default function AppPage() {
  return (
    <AnonGate>
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-xl font-bold">ポジミル</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            そのエントリー、ルール通り？ 結果を知る前の判断だけを、あなたのプレイブックに照らして監査します。
          </p>
        </header>
        <ReviewForm />
      </main>
    </AnonGate>
  );
}
