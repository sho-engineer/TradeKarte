import type { Review } from "@/lib/review/types";

const VERDICT_STYLES: Record<string, string> = {
  エッジ: "bg-edge/15 text-edge border-edge/40",
  衝動: "bg-impulse/15 text-impulse border-impulse/40",
  混在: "bg-mixed/15 text-mixed border-mixed/40",
};

export function VerdictChip({ verdict }: { verdict: string }) {
  const style = VERDICT_STYLES[verdict] ?? "bg-panel-2 text-muted border-line";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 font-mono text-sm font-semibold ${style}`}
    >
      {verdict}
    </span>
  );
}

export interface KarteMeta {
  createdAt?: string | null;
  pair?: string | null;
  direction?: string | null;
  result?: string | null;
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
  return (
    <article className="rounded-xl border border-line bg-panel p-5 sm:p-6 space-y-5">
      {warnings.length > 0 && (
        <div className="rounded-lg border border-impulse/40 bg-impulse/10 px-4 py-3 space-y-1">
          <p className="font-mono text-xs tracking-wider text-impulse">
            PATTERN ALERT
          </p>
          {warnings.map((w) => (
            <p key={w} className="text-sm text-ink">
              {w}
            </p>
          ))}
        </div>
      )}

      <header className="flex flex-wrap items-center gap-3">
        <VerdictChip verdict={review.verdict} />
        <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted">
          {meta?.createdAt && <span>{meta.createdAt}</span>}
          {meta?.pair && <span>{meta.pair}</span>}
          {meta?.direction && <span>{meta.direction}</span>}
          {meta?.result && <span>結果: {meta.result}</span>}
        </div>
      </header>

      {meta?.thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.thumbUrl}
          alt="チャート"
          className="w-full max-w-md rounded-lg border border-line"
        />
      )}

      {meta?.memo && (
        <section>
          <h3 className="mb-1 font-mono text-xs tracking-wider text-muted">
            MEMO
          </h3>
          <p className="whitespace-pre-wrap text-sm text-ink/90">{meta.memo}</p>
        </section>
      )}

      <section>
        <h3 className="mb-1 font-mono text-xs tracking-wider text-accent">
          所見（コーチ）
        </h3>
        <p className="text-sm leading-relaxed">{review.coach}</p>
      </section>

      <section>
        <h3 className="mb-1 font-mono text-xs tracking-wider text-impulse">
          指摘（批判者）
        </h3>
        <p className="text-sm leading-relaxed">{review.critic}</p>
      </section>

      <section>
        <h3 className="mb-1 font-mono text-xs tracking-wider text-mixed">
          次の一手
        </h3>
        <p className="text-sm leading-relaxed">{review.next_action}</p>
      </section>

      {review.tags.length > 0 && (
        <footer className="flex flex-wrap gap-2 border-t border-line pt-4">
          {review.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-panel-2 px-2 py-1 font-mono text-xs text-muted"
            >
              #{tag}
            </span>
          ))}
        </footer>
      )}
    </article>
  );
}
