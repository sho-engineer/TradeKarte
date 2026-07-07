import Link from "next/link";
import VerdictStamp from "@/components/VerdictStamp";
import { formatRecordNo, type KarteRow } from "@/lib/db";
import { VERDICTS } from "@/lib/review/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

type ListRow = Pick<
  KarteRow,
  "id" | "created_at" | "verdict" | "coach" | "tags" | "seq"
>;

function formatLedgerDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function HistoryPage({
  searchParams,
}: PageProps<"/app/history">) {
  const { verdict } = await searchParams;
  const filter =
    typeof verdict === "string" &&
    (VERDICTS as readonly string[]).includes(verdict)
      ? verdict
      : null;

  if (!isSupabaseConfigured()) {
    return (
      <div className="tk-page">
        <div className="tk-page__col tk-page__col--wide tk-card">
          <p className="tk-history__empty">
            台帳を使うには Supabase の設定とログインが必要です。
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  let query = supabase
    .from("karte")
    .select("id, created_at, verdict, coach, tags, seq", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter) query = query.eq("verdict", filter);
  const { data, count, error } = await query;

  if (error) {
    return (
      <div className="tk-page">
        <div className="tk-page__col tk-page__col--wide tk-card">
          <p className="tk-history__empty">台帳の取得に失敗しました。</p>
        </div>
      </div>
    );
  }
  const rows = (data ?? []) as ListRow[];

  const filters = [
    { label: "全て", href: "/app/history", active: !filter },
    ...VERDICTS.map((v) => ({
      label: v,
      href: `/app/history?verdict=${encodeURIComponent(v)}`,
      active: filter === v,
    })),
  ];

  const filterChips = (
    <div className="tk-history__filters">
      {filters.map((f) => (
        <Link
          key={f.label}
          href={f.href}
          className={
            "tk-history__filter" + (f.active ? " tk-history__filter--active" : "")
          }
        >
          {f.label}
        </Link>
      ))}
    </div>
  );

  return (
    <div className="tk-page">
      <div className="tk-page__col tk-page__col--wide">
        <div className="tk-card">
          <div className="tk-history__head">
            <div>
              <div className="tk-history__title">カルテ台帳</div>
              <div className="tk-history__subtitle">
                <span className="tk-only-desktop-inline">
                  RECORD LEDGER ·{" "}
                </span>
                全 {count ?? rows.length} 件
              </div>
            </div>
            <div className="tk-only-desktop">{filterChips}</div>
          </div>

          <div className="tk-history__filters-mobile tk-only-mobile">
            {filterChips}
          </div>

          {rows.length === 0 ? (
            <p className="tk-history__empty">
              {filter
                ? `「${filter}」のカルテはまだありません。`
                : "まだカルテがありません。"}{" "}
              <Link href="/app">最初の診断を依頼する →</Link>
            </p>
          ) : (
            <>
              <div className="tk-only-desktop">
                <div className="tk-history__colhead">
                  <span>判定</span>
                  <span>No.</span>
                  <span>日時</span>
                  <span>所見（要約）</span>
                  <span className="tk-history__colhead-tag">タグ</span>
                </div>
                {rows.map((r) => (
                  <Link
                    href={`/app/karte/${r.id}`}
                    className="tk-history__row"
                    key={r.id}
                  >
                    <VerdictStamp verdict={r.verdict} size="sm" withLabel={false} />
                    <span className="tk-history__id">
                      {formatRecordNo(r.created_at, r.seq)}
                    </span>
                    <span className="tk-history__date">
                      {formatLedgerDate(r.created_at)}
                    </span>
                    <span className="tk-history__summary">{r.coach}</span>
                    <span className="tk-history__tag">{r.tags[0] ?? ""}</span>
                  </Link>
                ))}
              </div>

              <div className="tk-only-mobile">
                {rows.map((r) => (
                  <Link
                    href={`/app/karte/${r.id}`}
                    className="tk-history__row-mobile"
                    key={r.id}
                  >
                    <VerdictStamp verdict={r.verdict} size="sm" withLabel={false} />
                    <div className="tk-history__row-mobile-body">
                      <div className="tk-history__row-mobile-meta">
                        <span className="tk-history__id">
                          {formatRecordNo(r.created_at, r.seq)}
                        </span>
                        <span className="tk-history__date">
                          {formatLedgerDate(r.created_at).slice(0, 10)}
                        </span>
                      </div>
                      <div className="tk-history__summary-mobile">{r.coach}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
