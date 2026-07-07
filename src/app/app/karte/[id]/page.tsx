import Link from "next/link";
import { notFound } from "next/navigation";
import KarteCard from "@/components/KarteCard";
import { deleteKarte } from "@/app/app/actions";
import {
  formatJst,
  formatRecordNo,
  THUMB_BUCKET,
  type KarteRow,
} from "@/lib/db";
import { detectPatterns, PATTERN_WINDOW_DAYS } from "@/lib/pattern";
import type { Review } from "@/lib/review/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export default async function KarteDetailPage({
  params,
}: PageProps<"/app/karte/[id]">) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="tk-page">
        <div className="tk-page__col tk-card">
          <p className="tk-history__empty">
            カルテ詳細を見るには Supabase の設定とログインが必要です。
          </p>
        </div>
      </div>
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
    .select("tags, verdict, emotion_gap")
    .lte("created_at", row.created_at)
    .gte("created_at", windowStart)
    .neq("id", row.id);
  const review: Review = {
    verdict: row.verdict as Review["verdict"],
    coach: row.coach,
    critic: row.critic,
    next_action: row.next_action,
    tags: row.tags,
    emotion_gap: row.emotion_gap ?? false,
  };
  const warnings = detectPatterns(
    {
      tags: review.tags,
      verdict: review.verdict,
      emotionGap: review.emotion_gap,
    },
    history ?? [],
  );

  return (
    <div className="tk-page">
      <div className="tk-page__col space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href="/app/history"
            className="tk-topbar__link"
          >
            ← 台帳に戻る
          </Link>
          <form action={deleteKarte}>
            <input type="hidden" name="id" value={row.id} />
            <button type="submit" className="tk-btn tk-btn--danger-ghost">
              このカルテを削除
            </button>
          </form>
        </div>

        <KarteCard
          review={review}
          warnings={warnings}
          meta={{
            recordNo: formatRecordNo(row.created_at, row.seq),
            createdAt:
              formatJst(row.created_at).replaceAll("/", ".") + " JST",
            pair: row.pair,
            direction: row.direction,
            result: row.result,
            emotionPre: row.emotion_pre,
            memo: row.memo,
            thumbUrl,
          }}
        />
      </div>
    </div>
  );
}
