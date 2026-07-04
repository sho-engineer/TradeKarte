import Link from "next/link";
import { notFound } from "next/navigation";
import KarteCard from "@/components/KarteCard";
import { deleteKarte } from "@/app/app/actions";
import { formatJst, THUMB_BUCKET, type KarteRow } from "@/lib/db";
import { detectPatterns, PATTERN_WINDOW_DAYS } from "@/lib/pattern";
import type { Review } from "@/lib/review/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export default async function KarteDetailPage({
  params,
}: PageProps<"/app/karte/[id]">) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-muted">
        カルテ詳細を見るには Supabase の設定とログインが必要です。
      </p>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("karte")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) notFound();
  const row = data as KarteRow;

  let thumbUrl: string | null = null;
  if (row.image_thumb_url) {
    const { data: signed } = await supabase.storage
      .from(THUMB_BUCKET)
      .createSignedUrl(row.image_thumb_url, 3600);
    thumbUrl = signed?.signedUrl ?? null;
  }

  // このカルテ作成時点から遡って30日間のパターンを再計算
  const windowStart = new Date(
    new Date(row.created_at).getTime() -
      PATTERN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: history } = await supabase
    .from("karte")
    .select("tags, verdict")
    .lte("created_at", row.created_at)
    .gte("created_at", windowStart)
    .neq("id", row.id);
  const review: Review = {
    verdict: row.verdict as Review["verdict"],
    coach: row.coach,
    critic: row.critic,
    next_action: row.next_action,
    tags: row.tags,
  };
  const warnings = detectPatterns(review, history ?? []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/app/history"
          className="text-sm text-muted hover:text-ink"
        >
          ← 履歴に戻る
        </Link>
        <form action={deleteKarte}>
          <input type="hidden" name="id" value={row.id} />
          <button
            type="submit"
            className="rounded-lg border border-impulse/40 px-3 py-1.5 text-xs text-impulse hover:bg-impulse/10"
          >
            このカルテを削除
          </button>
        </form>
      </div>

      <KarteCard
        review={review}
        warnings={warnings}
        meta={{
          createdAt: formatJst(row.created_at),
          pair: row.pair,
          direction: row.direction,
          result: row.result,
          memo: row.memo,
          thumbUrl,
        }}
      />
    </div>
  );
}
