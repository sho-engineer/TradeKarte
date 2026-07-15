import { z } from "zod";
import {
  DIRECTIONS,
  EMOTIONS,
  MEMORY_SOURCES,
  type BlindIntegrity,
  type NormalizedRule,
  type PlaybookRules,
} from "./types";

// /api/review のリクエストDTO(機能設計書 v3.3 §4/§6/§10.2)。
// strictObject のため result / pnl_pips / exit_reason / user_id などの
// 未定義キーはZodレベルで拒否される(AI-REQ-002/004、AUTH-002)。
// ※感情(emotion_pre)はkarteの保存項目(§4.2/§11)としてDTOに含めるが、
//   AIリクエストへは一切渡さない(FORM-005/AI-REQ-003)。

const ruleLine = z
  .string()
  .min(1)
  .max(200)
  .refine((t) => !/[\r\n]/.test(t), "1行1条件で入力してください");

const playbookSnapshotSchema = z.strictObject({
  must_rules: z
    .array(z.strictObject({ rule_id: z.string(), text: ruleLine }))
    .max(3),
  avoid_rules: z
    .array(z.strictObject({ rule_id: z.string(), text: ruleLine }))
    .max(2),
  stop_rule: z
    .strictObject({ rule_id: z.string(), text: ruleLine })
    .nullable(),
});

// IANA名のみ許可("JST"等のレガシー略称はICUが解釈しても拒否する)
let ianaTimezones: Set<string> | null = null;
function isValidTimezone(tz: string): boolean {
  if (!ianaTimezones) {
    ianaTimezones = new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);
  }
  return ianaTimezones.has(tz);
}

export const reviewRequestSchema = z.strictObject({
  /** クロップ済み画像のみ(image/jpeg data URL)。元画像は受け取らない */
  image: z
    .string()
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/, {
      message: "クロップ済みのJPEG data URLが必要です",
    })
    .max(8_000_000),
  trade_at: z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "trade_at はISO日時で指定してください",
  }),
  trade_timezone: z.string().refine(isValidTimezone, {
    message: "trade_timezone はIANAタイムゾーン名で指定してください",
  }),
  pair: z.string().min(1).max(20),
  direction: z.enum(DIRECTIONS),
  playbook_id: z.string().min(1),
  playbook_snapshot: playbookSnapshotSchema,
  playbook_created_for_this_review: z.boolean(),
  playbook_edited_for_this_review: z.boolean(),
  entry_reason: z.string().min(1).max(4000),
  memory_source: z.enum(MEMORY_SOURCES),
  emotion_pre: z.enum(EMOTIONS).nullable().optional(),
  result_word_detected: z.boolean(),
  result_warning_overridden: z.boolean(),
  /** クロップ後プレビューの確認なしではAPIを呼ばない(IMG-008) */
  image_blind_confirmed: z.literal(true),
  /** 入力訂正による改訂(§14)。結果入力だけでは作らない */
  revision_of: z.string().min(1).optional(),
  /** 同一入力の再実行・モデル比較(§10.2-9)。新しいkarteを作らない */
  rerun_of_karte_id: z.string().min(1).optional(),
  experiment_id: z.string().min(1).max(100).optional(),
});

export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

export type DtoResult =
  | { ok: true; value: ReviewRequest }
  | { ok: false; message: string };

export function parseReviewRequest(body: unknown): DtoResult {
  const r = reviewRequestSchema.safeParse(body);
  if (!r.success) {
    const issue = r.error.issues[0];
    const path = issue?.path.join(".") || "(root)";
    return { ok: false, message: `${path}: ${issue?.message ?? "invalid"}` };
  }
  if (r.data.revision_of && r.data.rerun_of_karte_id) {
    return {
      ok: false,
      message: "revision_of と rerun_of_karte_id は同時指定できません",
    };
  }
  return { ok: true, value: r.data };
}

/**
 * rule_id の採番規則を検証する(PB-003: must_1..must_3 / avoid_1..avoid_2 /
 * stop_1、欠番・重複なし)。合計1〜6条件。
 */
export function validateRuleIds(snapshot: PlaybookRules): string | null {
  for (let i = 0; i < snapshot.must_rules.length; i++) {
    if (snapshot.must_rules[i].rule_id !== `must_${i + 1}`) {
      return `must_rules[${i}] のrule_idは must_${i + 1} であるべきです`;
    }
  }
  for (let i = 0; i < snapshot.avoid_rules.length; i++) {
    if (snapshot.avoid_rules[i].rule_id !== `avoid_${i + 1}`) {
      return `avoid_rules[${i}] のrule_idは avoid_${i + 1} であるべきです`;
    }
  }
  if (snapshot.stop_rule && snapshot.stop_rule.rule_id !== "stop_1") {
    return "stop_rule のrule_idは stop_1 であるべきです";
  }
  const total =
    snapshot.must_rules.length +
    snapshot.avoid_rules.length +
    (snapshot.stop_rule ? 1 : 0);
  if (total < 1) return "プレイブックには最低1条件が必要です";
  if (total > 6) return "プレイブックは最大6条件です";
  return null;
}

/** AIへ渡す正規化条件へ変換する(§3.3) */
export function normalizeRules(snapshot: PlaybookRules): NormalizedRule[] {
  return [
    ...snapshot.must_rules.map((r) => ({
      rule_id: r.rule_id,
      rule_type: "required" as const,
      rule_text: r.text,
    })),
    ...snapshot.avoid_rules.map((r) => ({
      rule_id: r.rule_id,
      rule_type: "avoid" as const,
      rule_text: r.text,
    })),
    ...(snapshot.stop_rule
      ? [
          {
            rule_id: snapshot.stop_rule.rule_id,
            rule_type: "invalidation" as const,
            rule_text: snapshot.stop_rule.text,
          },
        ]
      : []),
  ];
}

/**
 * ブラインド完全性(§5.2)。成功カルテは clean / warning_overridden のみ。
 * フラグの組み合わせが不整合な場合は null(リクエスト拒否)。
 */
export function deriveBlindIntegrity(
  detected: boolean,
  overridden: boolean,
): BlindIntegrity | null {
  if (!detected && !overridden) return "clean";
  if (detected && overridden) return "warning_overridden";
  return null;
}
