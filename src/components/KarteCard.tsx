import type { Review } from "@/lib/review/types";
import { verdictMeta } from "@/lib/review/verdict";

export function VerdictChip({ verdict }: { verdict: string }) {
  const m = verdictMeta(verdict);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 font-mono text-sm font-semibold ${m.chip}`}
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

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="truncate text-sm text-ink">{value}</dd>
    </div>
  );
}

function Section({
  label,
  icon,
  colorText,
  colorBorder,
  colorSoft,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  colorText: string;
  colorBorder: string;
  colorSoft: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-lg border-l-2 ${colorBorder} ${colorSoft} py-3 pl-4 pr-3`}>
      <h3
        className={`mb-1.5 flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider ${colorText}`}
      >
        {icon}
        {label}
      </h3>
      <p className="text-sm leading-relaxed text-ink/90">{children}</p>
    </section>
  );
}

const IconCoach = (
  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
    <path
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const IconCritic = (
  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
    <path
      d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const IconNext = (
  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
    <path
      d="M5 12h14m0 0l-6-6m6 6l-6 6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const IconAlert = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
    <path
      d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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
    meta?.createdAt && { label: "日時", value: meta.createdAt },
    meta?.pair && { label: "通貨ペア", value: meta.pair },
    meta?.direction && { label: "方向", value: meta.direction },
    meta?.result && { label: "結果", value: meta.result },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <article className="animate-fade-in-up overflow-hidden rounded-xl border border-line-strong bg-panel shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_12px_32px_-16px_rgba(0,0,0,0.6)]">
      {warnings.length > 0 && (
        <div className="flex items-start gap-2.5 border-b border-impulse/30 bg-impulse/10 px-5 py-3 text-impulse">
          {IconAlert}
          <div className="space-y-0.5">
            <p className="font-mono text-[10px] font-semibold tracking-widest">
              PATTERN ALERT
            </p>
            {warnings.map((w) => (
              <p key={w} className="text-sm text-ink">
                {w}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 判定スタンプ帯 */}
      <header
        className={`flex items-center justify-between gap-3 border-b border-line px-5 py-4 ${m.soft}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border ${m.chip}`}
          >
            <span className="font-mono text-base font-bold leading-none">
              {review.verdict}
            </span>
          </div>
          <div>
            <p className={`font-mono text-sm font-semibold ${m.text}`}>
              {m.gloss}
            </p>
            <p className="mt-0.5 text-xs text-muted">{m.description}</p>
          </div>
        </div>
        <p className="hidden max-w-[9rem] text-right text-[10px] leading-tight text-muted sm:block">
          判定は損益と独立。エントリー時点の情報のみで評価。
        </p>
      </header>

      <div className="space-y-5 px-5 py-5">
        {metaCells.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-line bg-bg-2/50 p-3 sm:grid-cols-4">
            {metaCells.map((c) => (
              <MetaCell key={c.label} label={c.label} value={c.value} />
            ))}
          </dl>
        )}

        {meta?.thumbUrl && (
          <figure className="overflow-hidden rounded-lg border border-line-strong">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={meta.thumbUrl}
              alt="チャート"
              className="w-full max-w-lg"
            />
          </figure>
        )}

        {meta?.memo && (
          <section className="rounded-lg border border-line bg-bg-2/50 px-4 py-3">
            <h3 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">
              Memo
            </h3>
            <p className="whitespace-pre-wrap text-sm text-ink/80">
              {meta.memo}
            </p>
          </section>
        )}

        <div className="space-y-3">
          <Section
            label="所見（コーチ）"
            icon={IconCoach}
            colorText="text-edge"
            colorBorder="border-edge"
            colorSoft="bg-edge/5"
          >
            {review.coach}
          </Section>
          <Section
            label="指摘（批判者）"
            icon={IconCritic}
            colorText="text-impulse"
            colorBorder="border-impulse"
            colorSoft="bg-impulse/5"
          >
            {review.critic}
          </Section>
          <Section
            label="次の一手"
            icon={IconNext}
            colorText="text-mixed"
            colorBorder="border-mixed"
            colorSoft="bg-mixed/5"
          >
            {review.next_action}
          </Section>
        </div>

        {review.tags.length > 0 && (
          <footer className="flex flex-wrap gap-2 border-t border-line pt-4">
            {review.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-line bg-panel-2 px-2 py-1 font-mono text-xs text-muted"
              >
                #{tag}
              </span>
            ))}
          </footer>
        )}
      </div>
    </article>
  );
}
