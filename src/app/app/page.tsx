import ReviewForm from "@/components/ReviewForm";

export default function AppPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">新規カルテ</h1>
        <p className="mt-1 text-sm text-muted">
          チャート画像と状況メモから、AIが意思決定の質をレビューします。
        </p>
      </div>
      <ReviewForm />
    </div>
  );
}
