import type { NormalizedRule, ReviewOutput } from "../types";
import type { PlaybookRules } from "../types";

/** 6条件フルセットのプレイブック(must3 / avoid2 / stop1) */
export function makeSnapshot(): PlaybookRules {
  return {
    must_rules: [
      { rule_id: "must_1", text: "上位足が上昇トレンド" },
      { rule_id: "must_2", text: "サポートへ到達" },
      { rule_id: "must_3", text: "反発を確認" },
    ],
    avoid_rules: [
      { rule_id: "avoid_1", text: "急騰直後は見送る" },
      { rule_id: "avoid_2", text: "指標発表の直前" },
    ],
    stop_rule: { rule_id: "stop_1", text: "直近安値を明確に下抜けたら無効" },
  };
}

export function makeRules(): NormalizedRule[] {
  return [
    { rule_id: "must_1", rule_type: "required", rule_text: "上位足が上昇トレンド" },
    { rule_id: "must_2", rule_type: "required", rule_text: "サポートへ到達" },
    { rule_id: "must_3", rule_type: "required", rule_text: "反発を確認" },
    { rule_id: "avoid_1", rule_type: "avoid", rule_text: "急騰直後は見送る" },
    { rule_id: "avoid_2", rule_type: "avoid", rule_text: "指標発表の直前" },
    {
      rule_id: "stop_1",
      rule_type: "invalidation",
      rule_text: "直近安値を明確に下抜けたら無効",
    },
  ];
}

/** 入力6条件に対する正しいAI出力(AI-OUT-001の正常系) */
export function makeValidReview(): ReviewOutput {
  return {
    assessment: "ruleok",
    confirmed_facts: [
      "画像より: 直近高値切り上げの上昇トレンドが確認できる",
      "ユーザー文章より: サポート到達を根拠として記録している",
    ],
    rule_check: [
      {
        rule_id: "must_1",
        rule_type: "required",
        rule_text: "上位足が上昇トレンド",
        observation: "met",
        adherence: "compliant",
        reason: "画像より: 高値と安値の切り上げが続いている",
      },
      {
        rule_id: "must_2",
        rule_type: "required",
        rule_text: "サポートへ到達",
        observation: "met",
        adherence: "compliant",
        reason: "画像より: 直近サポート帯へ接触している",
      },
      {
        rule_id: "must_3",
        rule_type: "required",
        rule_text: "反発を確認",
        observation: "met",
        adherence: "compliant",
        reason: "画像より: サポート帯で陽線の反発が出ている",
      },
      {
        rule_id: "avoid_1",
        rule_type: "avoid",
        rule_text: "急騰直後は見送る",
        observation: "not_met",
        adherence: "compliant",
        reason: "画像より: 直前に急騰は見られない",
      },
      {
        rule_id: "avoid_2",
        rule_type: "avoid",
        rule_text: "指標発表の直前",
        observation: "unknown",
        adherence: "unknown",
        reason: "画像・文章から指標時刻は確認できない",
      },
      {
        rule_id: "stop_1",
        rule_type: "invalidation",
        rule_text: "直近安値を明確に下抜けたら無効",
        observation: "not_met",
        adherence: "compliant",
        reason: "画像より: 直近安値は維持されている",
      },
    ],
    behavior_signals: [],
    missing_information: ["上位足チャートそのもの"],
    reflection_question:
      "急騰時に見送る条件は、エントリー前に定義されていましたか？",
    confidence: "medium",
  };
}

/** 1x1 白ピクセルのJPEG data URL(テスト用の最小画像) */
export const TINY_JPEG_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
