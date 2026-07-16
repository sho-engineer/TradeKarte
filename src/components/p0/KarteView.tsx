"use client";

import { useState } from "react";
import {
  ASSESSMENT_LABELS,
  EMOTION_LABELS,
  FEEDBACK_RATINGS,
  INCORRECT_AREAS,
  TRADE_RESULTS,
  type AssessmentKey,
  type Adherence,
  type EmotionKey,
  type FeedbackRating,
  type IncorrectArea,
  type Observation,
  type ReviewOutput,
  type TradeResult,
} from "@/lib/p0/types";

// カルテ表示(機能設計書 v3.3 §11)。8見出しで6分類を潰さない。
// - 表示は検証済み内部キー→日本語変換のみ。AI生文字列をclassへ入れない
//   (CLASS-003)。文字列はテキストノードとしてのみ描画する
// - observation と adherence は別表示(CLASS-004)
// - 感情と行動兆候は並列表示し、一致・不一致・因果を自動判定しない(EMO-002)
// - 画像は再表示しない(§5.3)

interface Props {
  karteId: string;
  review: ReviewOutput;
  isCanonical: boolean;
  emotionPre: EmotionKey | null;
  meta: {
    pair: string;
    direction: "long" | "short";
    tradeAt: string;
    tradeTimezone: string;
  };
  /** 同一入力での再実行(§10.2-9)。実行中は無効化 */
  onRerun?: () => void;
  rerunning?: boolean;
}

// 検証済みキーのみを持つ表示メタ(CLASS-003: AI出力を直接classに使わない)
const ASSESSMENT_STYLES: Record<AssessmentKey, string> = {
  ruleok: "text-(--edge) border-(--tk-edge-border)",
  insufficient: "text-(--mixed) border-(--tk-mixed-border)",
  violation: "text-(--impulse) border-(--tk-impulse-border)",
  impulse: "text-(--impulse) border-(--tk-impulse-border)",
  mix: "text-(--mixed) border-(--tk-mixed-border)",
  unknown: "text-muted border-line",
};

const OBSERVATION_LABELS: Record<Observation, string> = {
  met: "該当あり",
  not_met: "該当なし",
  unknown: "判定不能",
};

const ADHERENCE_LABELS: Record<Adherence, string> = {
  compliant: "遵守",
  violated: "逸脱",
  unknown: "判定不能",
};

const RULE_TYPE_LABELS = {
  required: "必須",
  avoid: "見送り",
  invalidation: "無効化",
} as const;

const RESULT_LABELS: Record<TradeResult, string> = {
  win: "勝ち",
  loss: "負け",
  breakeven: "建値",
};

const RATING_LABELS: Record<FeedbackRating, string> = {
  helpful: "役に立った",
  partial: "部分的に役に立った",
  not_helpful: "役に立たなかった",
};

const AREA_LABELS: Record<IncorrectArea, string> = {
  chart_reading: "チャートの読み取り",
  rule_parsing: "ルールの解釈",
  rule_alignment: "ルール照合",
  behavior_signal: "行動兆候",
  assessment: "判定(6分類)",
  reflection_question: "振り返りの問い",
  other: "その他",
};

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line pt-4">
      <h3 className="flex items-baseline gap-2 text-sm font-bold">
        <span className="font-mono text-xs text-muted">{n}</span>
        {title}
      </h3>
      <div className="mt-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

async function postJson(path: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const json = await res.json().catch(() => null);
    return (json?.error as string) ?? "保存に失敗しました";
  } catch {
    return "通信に失敗しました";
  }
}

/** 結果の後入力(§12)。AIは再実行されず、判断監査は変わらない */
function ResultEntry({ karteId }: { karteId: string }) {
  const [result, setResult] = useState<TradeResult | null>(null);
  const [pips, setPips] = useState("");
  const [exitReason, setExitReason] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!result) {
      setError("結果を選択してください");
      return;
    }
    const pnl = pips.trim() === "" ? null : Number(pips);
    if (pnl !== null && !Number.isFinite(pnl)) {
      setError("Pipsは数値で入力してください");
      return;
    }
    setState("saving");
    setError(null);
    const err = await postJson(`/api/karte/${karteId}/result`, {
      result,
      pnl_pips: pnl,
      exit_reason: exitReason.trim() || null,
    });
    if (err) {
      setError(err);
      setState("idle");
    } else {
      setState("saved");
    }
  };

  if (state === "saved") {
    return (
      <p className="text-xs text-muted">
        結果を保存しました({result ? RESULT_LABELS[result] : ""}
        {pips.trim() !== "" ? ` / ${pips} pips` : ""})。
        判断監査(上のレビュー内容)は変わりません。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted">
        決済後に結果を記録できます。ここに入力してもAIは再実行されず、判断監査は変わりません。
      </p>
      <div className="flex flex-wrap gap-2">
        {TRADE_RESULTS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setResult(r)}
            className={`tk-pill ${result === r ? "tk-pill--active" : ""}`}
          >
            {RESULT_LABELS[r]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-muted">Pips(任意)</span>
          <input
            type="number"
            step="0.1"
            value={pips}
            onChange={(e) => setPips(e.target.value)}
            className="w-32 border border-line bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </label>
        <label className="min-w-48 flex-1 space-y-1">
          <span className="block text-xs text-muted">決済理由(任意)</span>
          <input
            type="text"
            maxLength={500}
            value={exitReason}
            onChange={(e) => setExitReason(e.target.value)}
            className="w-full border border-line bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </label>
      </div>
      {error && <p className="text-xs text-impulse">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={state === "saving"}
        className="tk-btn tk-btn--ghost"
      >
        {state === "saving" ? "保存中…" : "結果を保存"}
      </button>
    </div>
  );
}

/** 構造化フィードバック(§13) */
function FeedbackEntry({ karteId }: { karteId: string }) {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [areas, setAreas] = useState<IncorrectArea[]>([]);
  const [corrected, setCorrected] = useState<AssessmentKey | "">("");
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const toggleArea = (a: IncorrectArea) => {
    setAreas((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );
  };

  const save = async () => {
    if (!rating) {
      setError("評価を選択してください");
      return;
    }
    setState("saving");
    setError(null);
    const err = await postJson(`/api/karte/${karteId}/feedback`, {
      rating,
      incorrect_areas: areas,
      corrected_assessment: corrected || null,
      comment: comment.trim() || null,
    });
    if (err) {
      setError(err);
      setState("idle");
    } else {
      setState("saved");
    }
  };

  if (state === "saved") {
    return (
      <p className="text-xs text-muted">
        フィードバックを保存しました。ありがとうございます。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FEEDBACK_RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRating(r)}
            className={`tk-pill ${rating === r ? "tk-pill--active" : ""}`}
          >
            {RATING_LABELS[r]}
          </button>
        ))}
      </div>

      {rating && rating !== "helpful" && (
        <div className="space-y-3">
          <div>
            <span className="block text-xs text-muted">
              誤っていた箇所(複数選択可)
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {INCORRECT_AREAS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleArea(a)}
                  className={`tk-pill ${areas.includes(a) ? "tk-pill--active" : ""}`}
                >
                  {AREA_LABELS[a]}
                </button>
              ))}
            </div>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-muted">
              正しいと思う判定(任意)
            </span>
            <span className="tk-select-wrap block max-w-64">
              <select
                value={corrected}
                onChange={(e) =>
                  setCorrected(e.target.value as AssessmentKey | "")
                }
                className="tk-select w-full"
              >
                <option value="">選択しない</option>
                {(
                  Object.entries(ASSESSMENT_LABELS) as [AssessmentKey, string][]
                ).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>
      )}

      {rating && (
        <label className="block space-y-1">
          <span className="text-xs text-muted">コメント(任意)</span>
          <textarea
            value={comment}
            maxLength={2000}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="tk-textarea w-full"
          />
        </label>
      )}

      {error && <p className="text-xs text-impulse">{error}</p>}
      {rating && (
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="tk-btn tk-btn--ghost"
        >
          {state === "saving" ? "送信中…" : "フィードバックを送信"}
        </button>
      )}
    </div>
  );
}

export default function KarteView({
  karteId,
  review,
  isCanonical,
  emotionPre,
  meta,
  onRerun,
  rerunning,
}: Props) {
  const assessment = review.assessment;

  return (
    <article className="tk-card space-y-5 p-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xs text-muted">
            {meta.pair} / {meta.direction === "long" ? "ロング" : "ショート"} /{" "}
            {meta.tradeAt}({meta.tradeTimezone})
          </p>
          {!isCanonical && (
            <span className="border border-line px-2 py-0.5 font-mono text-[11px] text-muted">
              再実行結果(カルテは置き換えられません)
            </span>
          )}
        </div>
        <div
          className={`inline-block border px-4 py-2 ${ASSESSMENT_STYLES[assessment]}`}
        >
          <span className="block font-mono text-[11px] tracking-widest opacity-70">
            判断監査
          </span>
          <span className="text-lg font-bold">
            {ASSESSMENT_LABELS[assessment]}
          </span>
        </div>
        <p className="font-mono text-[11px] text-muted">
          AIの確信度: {review.confidence}
        </p>
      </header>

      <Section n={1} title="確認できた事実">
        {review.confirmed_facts.length === 0 ? (
          <p className="text-muted">なし</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            {review.confirmed_facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section n={2} title="ルール照合">
        <ul className="space-y-3">
          {review.rule_check.map((rc) => (
            <li key={rc.rule_id} className="border border-line p-3">
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[11px] text-muted">
                  {rc.rule_id}
                </span>
                <span className="border border-line px-1.5 py-0.5 text-[11px] text-muted">
                  {RULE_TYPE_LABELS[rc.rule_type]}
                </span>
                <span className="font-bold">{rc.rule_text}</span>
              </p>
              {/* observation(状況の該当)と adherence(ルール遵守)は別物として表示 */}
              <p className="mt-2 flex flex-wrap gap-4 font-mono text-xs">
                <span>
                  <span className="text-muted">状況: </span>
                  {OBSERVATION_LABELS[rc.observation]}
                </span>
                <span>
                  <span className="text-muted">遵守: </span>
                  {ADHERENCE_LABELS[rc.adherence]}
                </span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {rc.reason}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          「状況」は条件に該当する状況が観察されたか、「遵守」はあなたのルールを守れていたかを別々に示します(見送り条件では状況に該当しないことが遵守です)。
        </p>
      </Section>

      <Section n={3} title="矛盾・行動兆候">
        {review.behavior_signals.length === 0 ? (
          <p className="text-muted">検出された行動兆候はありません。</p>
        ) : (
          <ul className="space-y-2">
            {review.behavior_signals.map((s, i) => (
              <li key={i} className="border border-line p-3">
                <p className="font-bold">{s.signal}</p>
                <p className="mt-1 font-mono text-[11px] text-muted">
                  確信度: {s.confidence}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {s.reason}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section n={4} title="不足情報">
        {review.missing_information.length === 0 ? (
          <p className="text-muted">なし</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            {review.missing_information.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section n={5} title="振り返りの問い">
        <p className="border-l-2 border-(--accent) pl-3">
          {review.reflection_question}
        </p>
      </Section>

      <Section n={6} title="自己申告感情と行動兆候">
        <dl className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <dt className="w-44 shrink-0 text-muted">自己申告感情:</dt>
            <dd>{emotionPre ? EMOTION_LABELS[emotionPre] : "未入力"}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="w-44 shrink-0 text-muted">
              AIが検出した行動兆候:
            </dt>
            <dd>
              {review.behavior_signals.length === 0
                ? "なし"
                : review.behavior_signals.map((s) => s.signal).join(" / ")}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          自己申告感情とAIが検出した行動兆候を並べて表示しています。実際の感情や因果関係を断定するものではありません。
        </p>
      </Section>

      <Section n={7} title="結果を含む振り返り">
        <ResultEntry karteId={karteId} />
      </Section>

      <Section n={8} title="フィードバック">
        <FeedbackEntry karteId={karteId} />
      </Section>

      {onRerun && (
        <footer className="border-t border-line pt-4">
          <button
            type="button"
            onClick={onRerun}
            disabled={rerunning}
            className="tk-btn tk-btn--ghost"
          >
            {rerunning ? "再実行中…" : "同じ入力でもう一度レビューする"}
          </button>
          <p className="mt-1 text-[11px] text-muted">
            再実行しても保存済みのカルテは置き換えられません(比較用)。
          </p>
        </footer>
      )}
    </article>
  );
}
