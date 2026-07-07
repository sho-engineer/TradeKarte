import type { Review } from "@/lib/review/types";
import { verdictMeta } from "@/lib/review/verdict";
import VerdictStamp from "./VerdictStamp";

export interface KarteMeta {
  /** 台帳行に出すカルテ番号(例: TK-20260731-014) */
  recordNo?: string | null;
  createdAt?: string | null;
  pair?: string | null;
  direction?: string | null;
  result?: string | null;
  emotionPre?: string | null;
  memo?: string | null;
  thumbUrl?: string | null;
}

export default function KarteCard({
  review,
  meta,
  warnings = [],
}: {
  review: Review;
  meta?: KarteMeta;
  warnings?: string[];
}) {
  const m = verdictMeta(review.verdict);
  const metaCells = [
    meta?.pair && { label: "通貨ペア", value: meta.pair },
    meta?.direction && { label: "方向", value: meta.direction },
    meta?.result && {
      label: "結果",
      value: meta.result,
      dim: true,
      note: "判定に非影響",
    },
    meta?.emotionPre && { label: "自己申告", value: meta.emotionPre },
  ].filter(Boolean) as {
    label: string;
    value: string;
    dim?: boolean;
    note?: string;
  }[];

  return (
    <div className="animate-fade-in-up">
      {meta?.recordNo && (
        <div className="tk-karte__ledger">
          <span>RECORD</span>
          <span>No. {meta.recordNo}</span>
        </div>
      )}

      <article className="tk-karte__card">
        {/* masthead */}
        <div className="tk-karte__masthead">
          <div>
            <div className="tk-karte__title">診断カルテ</div>
            <div className="tk-karte__subtitle">DECISION QUALITY RECORD</div>
          </div>
          {meta?.createdAt && (
            <div className="tk-karte__timestamp">{meta.createdAt}</div>
          )}
        </div>

        {/* specimen */}
        {(meta?.thumbUrl || meta?.memo) && (
          <div className="tk-karte__specimen">
            <div className="tk-karte__specimen-head">
              <span className="tk-karte__specimen-label">
                検体 <span className="tk-only-desktop-inline">/ SPECIMEN</span>
              </span>
              <span className="tk-karte__specimen-meta">
                {[meta?.pair, "添付チャート"].filter(Boolean).join(" · ")}
              </span>
            </div>
            {meta?.thumbUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={meta.thumbUrl}
                alt="添付チャート"
                className="tk-karte__chart"
              />
            )}
            {meta?.memo && (
              <div className="tk-karte__memo">
                <div className="tk-karte__memo-label">状況メモ / NOTE</div>
                <div className="tk-karte__memo-text">{meta.memo}</div>
              </div>
            )}
          </div>
        )}

        {/* verdict */}
        <div className="tk-karte__verdict">
          <VerdictStamp verdict={review.verdict} />
          <div>
            <div className="tk-karte__verdict-label">判定 / VERDICT</div>
            <div className="tk-karte__verdict-headline">{m.headline}</div>
            {review.emotion_gap && (
              <span className="tk-karte__gap">⚡ 自己認識とズレ</span>
            )}
            <div className="tk-karte__verdict-note">
              判定は損益と独立。エントリー時点で得られた情報のみで評価しています。
            </div>
          </div>
        </div>

        {/* meta ledger */}
        {metaCells.length > 0 && (
          <div className="tk-karte__meta">
            {metaCells.map((c) => (
              <div key={c.label} className="tk-karte__meta-cell">
                <div className="tk-karte__meta-label">{c.label}</div>
                <div
                  className={
                    "tk-karte__meta-value" +
                    (c.dim ? " tk-karte__meta-value--dim" : "")
                  }
                >
                  {c.value}
                  {c.note && (
                    <span className="tk-karte__meta-note tk-only-desktop-inline">
                      {" "}
                      {c.note}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* numbered sections */}
        <Section
          first
          n="01"
          nColor="var(--tk-edge)"
          title="所見"
          tag="COACH"
          body={review.coach}
        />
        <Section
          n="02"
          nColor="var(--tk-impulse)"
          title="指摘"
          tag="CRITIC"
          body={review.critic}
        />
        <Section
          n="03"
          nColor="var(--tk-mixed)"
          title="次の一手"
          tag="HABIT"
          body={
            <>
              {review.next_action}{" "}
              <span className="tk-karte__disclaimer">
                ※これは過去の振り返りであり、売買の推奨ではありません。
              </span>
            </>
          }
        />

        {/* tags */}
        {review.tags.length > 0 && (
          <div className="tk-karte__tags">
            {review.tags.map((tag) => (
              <span key={tag} className="tk-karte__tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* pattern warnings */}
        {warnings.length > 0 && (
          <div className="tk-karte__pattern">
            <span className="tk-karte__pattern-label tk-only-desktop-inline">
              PATTERN
            </span>
            <div>
              {warnings.map((w) => (
                <span key={w} className="tk-karte__pattern-name">
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

function Section({
  n,
  nColor,
  title,
  tag,
  body,
  first,
}: {
  n: string;
  nColor: string;
  title: string;
  tag: string;
  body: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div
      className={
        "tk-karte__section" + (first ? " tk-karte__section--first" : "")
      }
    >
      <div className="tk-karte__section-head">
        <span className="tk-karte__section-n" style={{ color: nColor }}>
          {n}
        </span>
        <span className="tk-karte__section-title">{title}</span>
        <span className="tk-karte__section-tag tk-only-desktop-inline">
          {tag}
        </span>
        <span className="tk-karte__section-rule" />
      </div>
      <div className="tk-karte__section-body">{body}</div>
    </div>
  );
}
