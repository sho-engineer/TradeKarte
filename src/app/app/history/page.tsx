import Link from "next/link";
import { VerdictChip } from "@/components/KarteCard";
import { formatJst, THUMB_BUCKET, type KarteRow } from "@/lib/db";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

type ListRow = Pick<
  KarteRow,
  | "id"
  | "created_at"
  | "pair"
  | "direction"
  | "result"
  | "verdict"
  | "tags"
  | "image_thumb_url"
  | "memo"
>;

export default async function HistoryPage() {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-muted">
        履歴機能を使うには Supabase の設定とログインが必要です。
      </p>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("karte")
    .select(
      "id, created_at, pair, direction, result, verdict, tags, image_thumb_url, memo",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <p className="text-sm text-impulse">履歴の取得に失敗しました。</p>
    );
  }
  const rows = (data ?? []) as ListRow[];

  const thumbPaths = rows
    .map((r) => r.image_thumb_url)
    .filter((p): p is string => Boolean(p));
  const signedUrlByPath = new Map<string, string>();
  if (thumbPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(THUMB_BUCKET)
      .createSignedUrls(thumbPaths, 3600);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) signedUrlByPath.set(s.path, s.signedUrl);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">カルテ履歴</h1>
        <p className="mt-1 text-sm text-muted">直近100件を表示しています。</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel p-8 text-center">
          <p className="text-sm text-muted">
            まだカルテがありません。
            <Link href="/app" className="text-accent hover:underline">
              最初のカルテを作成
            </Link>
            しましょう。
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const thumbUrl = row.image_thumb_url
              ? signedUrlByPath.get(row.image_thumb_url)
              : undefined;
            return (
              <li key={row.id}>
                <Link
                  href={`/app/karte/${row.id}`}
                  className="flex gap-4 rounded-xl border border-line bg-panel p-4 transition-colors hover:border-accent"
                >
                  {thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbUrl}
                      alt=""
                      className="h-16 w-24 shrink-0 rounded-md border border-line object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md border border-line bg-panel-2 font-mono text-[10px] text-muted">
                      NO IMG
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <VerdictChip verdict={row.verdict} />
                      <span className="font-mono text-xs text-muted">
                        {formatJst(row.created_at)}
                      </span>
                      {row.pair && (
                        <span className="font-mono text-xs text-muted">
                          {row.pair}
                        </span>
                      )}
                      {row.direction && (
                        <span className="font-mono text-xs text-muted">
                          {row.direction}
                        </span>
                      )}
                      {row.result && (
                        <span className="font-mono text-xs text-muted">
                          {row.result}
                        </span>
                      )}
                    </div>
                    {row.memo && (
                      <p className="truncate text-sm text-ink/80">{row.memo}</p>
                    )}
                    {row.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {row.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-muted"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
