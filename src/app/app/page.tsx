import ReviewForm from "@/components/ReviewForm";

export default function AppPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-line pb-5">
        <p className="font-mono text-[11px] uppercase tracking-widest text-accent">
          New Karte
        </p>
        <h1 className="mt-1 text-2xl font-bold">新規カルテ</h1>
        <p className="mt-1.5 text-sm text-muted">
          チャート画像と状況メモから、AIが意思決定の質を
          <span className="text-edge">エッジ</span>／
          <span className="text-impulse">衝動</span>／
          <span className="text-mixed">混在</span>
          で診断します。
        </p>
      </div>
      <ReviewForm />
    </div>
  );
}
