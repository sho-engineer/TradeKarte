"use client";

import { useMemo, useRef, useState } from "react";
import ChartCropper from "./ChartCropper";
import KarteView from "./KarteView";
import PlaybookEditor from "./PlaybookEditor";
import type { CropResult } from "@/lib/p0/crop";
import { detectResultWords } from "@/lib/p0/resultWords";
import {
  createNewVersion,
  createPlaybook,
  latestPlaybooks,
  loadPlaybooks,
  playbookToDraft,
  savePlaybooks,
  type PlaybookDraft,
  type StoredPlaybook,
} from "@/lib/p0/playbookLocal";
import {
  DIRECTIONS,
  EMOTIONS,
  EMOTION_LABELS,
  MEMORY_SOURCES,
  type Direction,
  type EmotionKey,
  type MemorySource,
  type ReviewOutput,
} from "@/lib/p0/types";

// 入力画面(機能設計書 v3.3 §4)+オンボーディング(§3.1)+送信フロー。
// - プレイブック0件時は登録必須(PB-005)
// - 結果語検出時は自動削除せず確認ダイアログ(§4.5)
// - クロップ確認チェックなしでは送信不可(IMG-008)
// - 感情はAIへ送信されない(サーバー側でも保証: AI-REQ-003)

const DIRECTION_LABELS: Record<Direction, string> = {
  long: "ロング(買い)",
  short: "ショート(売り)",
};

const MEMORY_SOURCE_LABELS: Record<MemorySource, string> = {
  recorded_at_time: "当時記録していた",
  from_memory: "記憶から入力した",
};

/** datetime-local の初期値(現在・分単位) */
function nowLocalValue(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ReviewResponse {
  karte_id: string;
  run_id: string;
  is_canonical: boolean;
  review: ReviewOutput;
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; response: ReviewResponse };

export default function ReviewForm() {
  // --- プレイブック ---
  // AnonGate 配下でクライアントマウント時のみ描画されるため、
  // localStorage 読込は初期化子で行える(SSR不整合なし)
  const [playbooks, setPlaybooks] = useState<StoredPlaybook[]>(() =>
    loadPlaybooks(),
  );
  const [selectedPbId, setSelectedPbId] = useState<string>("");
  const [editor, setEditor] = useState<
    | { mode: "create" }
    | { mode: "edit"; source: StoredPlaybook }
    | null
  >(null);
  // 振り返り時に新規作成/編集したプレイブック(§3.4 のフラグ用)
  const [createdIds] = useState(() => new Set<string>());
  const [editedIds] = useState(() => new Set<string>());

  const latest = useMemo(() => latestPlaybooks(playbooks), [playbooks]);
  const selectedPb = latest.find((p) => p.id === selectedPbId) ?? null;

  // --- 入力項目 ---
  const [tradeAt, setTradeAt] = useState(nowLocalValue);
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [timezones] = useState<string[]>(() => [
    ...Intl.supportedValuesOf("timeZone"),
  ]);
  const [pair, setPair] = useState("");
  const [direction, setDirection] = useState<Direction | null>(null);
  const [entryReason, setEntryReason] = useState("");
  const [memorySource, setMemorySource] = useState<MemorySource | null>(null);
  const [emotionPre, setEmotionPre] = useState<EmotionKey | null>(null);
  const [cropped, setCropped] = useState<{
    crop: CropResult;
    confirmed: boolean;
  } | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [resultWordHits, setResultWordHits] = useState<string[] | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });
  const [rerunning, setRerunning] = useState(false);
  const lastPayloadRef = useRef<Record<string, unknown> | null>(null);
  const entryReasonRef = useRef<HTMLTextAreaElement | null>(null);

  // --- プレイブック操作 ---
  const savePb = (draft: PlaybookDraft) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    let next: StoredPlaybook[];
    if (editor?.mode === "edit") {
      const nv = createNewVersion(editor.source, draft, id, now);
      next = [...playbooks, nv];
      editedIds.add(id);
      if (createdIds.has(editor.source.id)) createdIds.add(id);
    } else {
      next = [...playbooks, createPlaybook(draft, id, now)];
      createdIds.add(id);
    }
    setPlaybooks(next);
    savePlaybooks(next);
    setSelectedPbId(id);
    setEditor(null);
  };

  // --- 送信 ---
  const validate = (): string | null => {
    if (!tradeAt) return "取引日時を入力してください";
    if (!timezone) return "タイムゾーンを選択してください";
    if (!cropped) return "チャート画像を選択し、エントリー位置をタップしてください";
    if (!cropped.confirmed) return "クロップ後画像の確認チェックが必要です";
    if (!pair.trim()) return "通貨ペアを入力してください";
    if (!direction) return "方向(ロング/ショート)を選択してください";
    if (!selectedPb) return "プレイブックを選択してください";
    if (!entryReason.trim()) return "エントリー理由を入力してください";
    if (!memorySource) return "入力ソースを選択してください";
    return null;
  };

  const buildPayload = (override: boolean): Record<string, unknown> => {
    const hits = detectResultWords(entryReason);
    return {
      image: cropped!.crop.dataUrl,
      trade_at: new Date(tradeAt).toISOString(),
      trade_timezone: timezone,
      pair: pair.trim(),
      direction,
      playbook_id: selectedPb!.id,
      playbook_snapshot: selectedPb!.rules,
      playbook_created_for_this_review: createdIds.has(selectedPb!.id),
      playbook_edited_for_this_review: editedIds.has(selectedPb!.id),
      entry_reason: entryReason.trim(),
      memory_source: memorySource,
      emotion_pre: emotionPre,
      result_word_detected: hits.length > 0,
      result_warning_overridden: hits.length > 0 && override,
      image_blind_confirmed: true,
    };
  };

  const doPost = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        (json?.error as string) ??
        "レビューの生成に失敗しました。再試行してください";
      throw new Error(msg);
    }
    return json as ReviewResponse;
  };

  const send = async (override: boolean) => {
    setSubmit({ kind: "submitting" });
    const payload = buildPayload(override);
    lastPayloadRef.current = payload;
    try {
      const response = await doPost(payload);
      setSubmit({ kind: "success", response });
    } catch (e) {
      setSubmit({
        kind: "error",
        message: e instanceof Error ? e.message : "送信に失敗しました",
      });
    }
  };

  const onSubmit = () => {
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    // 結果語チェック(§4.5): 検出時は自動削除せず確認ダイアログ
    const hits = detectResultWords(entryReason);
    if (hits.length > 0) {
      setResultWordHits(hits);
      return;
    }
    void send(false);
  };

  const onRerun = async () => {
    if (submit.kind !== "success" || !lastPayloadRef.current) return;
    setRerunning(true);
    try {
      const response = await doPost({
        ...lastPayloadRef.current,
        rerun_of_karte_id: submit.response.karte_id,
      });
      // karte は置き換えず、表示のみ更新(is_canonical=false)
      setSubmit({
        kind: "success",
        response: { ...response, karte_id: submit.response.karte_id },
      });
    } catch {
      // 再実行失敗は現表示を維持
    } finally {
      setRerunning(false);
    }
  };

  // --- 表示 ---

  // オンボーディング: プレイブック0件時は登録必須(PB-005)
  if (latest.length === 0 || editor) {
    return (
      <div className="space-y-4">
        {latest.length === 0 && (
          <div className="tk-card p-5">
            <h2 className="text-sm font-bold">はじめに: 自分ルールの登録</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              ポジミルは、あなた自身のルール(プレイブック)に対して「その判断がルール通りだったか」を監査します。最初にプレイブックを1つ登録してください。
            </p>
          </div>
        )}
        <PlaybookEditor
          initial={
            editor && editor.mode === "edit"
              ? playbookToDraft(editor.source)
              : null
          }
          mode={editor?.mode === "edit" ? "edit" : "create"}
          onSave={savePb}
          onCancel={latest.length > 0 ? () => setEditor(null) : undefined}
        />
      </div>
    );
  }

  if (submit.kind === "success") {
    const r = submit.response;
    return (
      <div className="space-y-6">
        <KarteView
          karteId={r.karte_id}
          review={r.review}
          isCanonical={r.is_canonical}
          emotionPre={emotionPre}
          meta={{
            pair: pair.trim(),
            direction: direction ?? "long",
            tradeAt,
            tradeTimezone: timezone,
          }}
          onRerun={onRerun}
          rerunning={rerunning}
        />
        <button
          type="button"
          onClick={() => {
            setSubmit({ kind: "idle" });
            setCropped(null);
            setEntryReason("");
            setEmotionPre(null);
            setMemorySource(null);
            setTradeAt(nowLocalValue());
          }}
          className="tk-btn tk-btn--primary"
        >
          新しい振り返りを始める
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. 取引日時 */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold text-muted">1. 取引日時</h2>
        <div className="flex flex-wrap gap-3">
          <input
            type="datetime-local"
            value={tradeAt}
            onChange={(e) => setTradeAt(e.target.value)}
            className="border border-line bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <span className="tk-select-wrap">
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="tk-select"
              aria-label="取引タイムゾーン"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </span>
        </div>
      </section>

      {/* 2. チャート画像+エントリー位置 */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold text-muted">
          2. チャート画像(エントリー時点まで)
        </h2>
        <ChartCropper onChange={setCropped} />
      </section>

      {/* 3. 通貨ペア・方向 */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold text-muted">3. 通貨ペアと方向</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={pair}
            maxLength={20}
            placeholder="例: USD/JPY"
            onChange={(e) => setPair(e.target.value)}
            className="w-40 border border-line bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <div className="flex gap-2">
            {DIRECTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={`tk-pill ${direction === d ? "tk-pill--active" : ""}`}
              >
                {DIRECTION_LABELS[d]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4. プレイブック */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold text-muted">4. プレイブック</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="tk-select-wrap">
            <select
              value={selectedPbId}
              onChange={(e) => setSelectedPbId(e.target.value)}
              className="tk-select"
              aria-label="プレイブックを選択"
            >
              <option value="">選択してください</option>
              {latest.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}(v{p.version})
                </option>
              ))}
            </select>
          </span>
          <button
            type="button"
            onClick={() => setEditor({ mode: "create" })}
            className="tk-btn tk-btn--ghost"
          >
            新規作成
          </button>
          {selectedPb && (
            <button
              type="button"
              onClick={() => setEditor({ mode: "edit", source: selectedPb })}
              className="tk-btn tk-btn--ghost"
            >
              編集(新しい版)
            </button>
          )}
        </div>
        {selectedPb && (
          <ul className="space-y-1 border border-line p-3 text-xs leading-relaxed">
            {selectedPb.rules.must_rules.map((r) => (
              <li key={r.rule_id}>
                <span className="font-mono text-[11px] text-muted">必須 </span>
                {r.text}
              </li>
            ))}
            {selectedPb.rules.avoid_rules.map((r) => (
              <li key={r.rule_id}>
                <span className="font-mono text-[11px] text-muted">見送り </span>
                {r.text}
              </li>
            ))}
            {selectedPb.rules.stop_rule && (
              <li>
                <span className="font-mono text-[11px] text-muted">無効化 </span>
                {selectedPb.rules.stop_rule.text}
              </li>
            )}
          </ul>
        )}
      </section>

      {/* 5. エントリー理由 */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold text-muted">5. エントリー理由</h2>
        <textarea
          ref={entryReasonRef}
          value={entryReason}
          maxLength={4000}
          rows={5}
          onChange={(e) => setEntryReason(e.target.value)}
          className="tk-textarea w-full"
          placeholder="なぜこのタイミングでエントリーしたのかを、当時の判断として書いてください"
        />
        {/* §4.5: 常時表示の注意文 */}
        <p className="text-[11px] leading-relaxed text-muted">
          エントリー時点で考えていたことだけを書いてください。結果や決済後の情報は書かないでください。
        </p>
      </section>

      {/* 6. 入力ソース(必須)・感情(任意) */}
      <section className="space-y-3">
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-muted">
            6. この内容はいつ記録したものですか(必須)
          </h2>
          <div className="flex flex-wrap gap-2">
            {MEMORY_SOURCES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMemorySource(m)}
                className={`tk-pill ${memorySource === m ? "tk-pill--active" : ""}`}
              >
                {MEMORY_SOURCE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-muted">
            7. エントリー時の感情(任意・AIへは送信されません)
          </h2>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() =>
                  setEmotionPre((prev) => (prev === em ? null : em))
                }
                className={`tk-pill ${emotionPre === em ? "tk-pill--active" : ""}`}
              >
                {EMOTION_LABELS[em]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {formError && <p className="text-xs text-impulse">{formError}</p>}
      {submit.kind === "error" && (
        <p className="text-xs text-impulse">{submit.message}</p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submit.kind === "submitting"}
        className="tk-btn tk-btn--primary"
      >
        {submit.kind === "submitting"
          ? "AIレビューを実行中…"
          : "AIレビューを実行"}
      </button>

      {/* 結果語確認ダイアログ(§4.5: 自動削除しない・修正または続行) */}
      {resultWordHits && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="tk-card max-w-md space-y-4 p-5">
            <h3 className="text-sm font-bold">結果語が含まれている可能性</h3>
            <p className="text-xs leading-relaxed">
              エントリー理由に次の表現が見つかりました:{" "}
              <span className="font-bold">{resultWordHits.join("、")}</span>
            </p>
            <p className="text-xs leading-relaxed text-muted">
              結果を知った後の情報が混ざると、判断そのものの監査ができなくなります。エントリー時点で考えていたことだけに修正するか、このまま続行できます(続行した場合はその旨がカルテに記録されます)。
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setResultWordHits(null);
                  entryReasonRef.current?.focus();
                }}
                className="tk-btn tk-btn--primary"
              >
                修正する
              </button>
              <button
                type="button"
                onClick={() => {
                  setResultWordHits(null);
                  void send(true);
                }}
                className="tk-btn tk-btn--ghost"
              >
                このまま続行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
