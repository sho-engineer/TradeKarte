import { describe, expect, it } from "vitest";
import { validateReviewOutput } from "../schema";
import { makeRules, makeValidReview } from "./fixtures";

const rules = makeRules();

function expectFail(parsed: unknown, messagePart?: string) {
  const r = validateReviewOutput(parsed, rules);
  expect(r.ok).toBe(false);
  if (!r.ok && messagePart) {
    expect(r.message).toContain(messagePart);
  }
}

describe("AI出力検証(§8.1 / 必須テスト7章)", () => {
  it("AI-OUT-001: 正常出力はZod・rule mapping検証を通る", () => {
    const r = validateReviewOutput(makeValidReview(), rules);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.assessment).toBe("ruleok");
  });

  it("AI-OUT-002: assessment未知値を拒否する", () => {
    expectFail({ ...makeValidReview(), assessment: "great" });
    expectFail({ ...makeValidReview(), assessment: "最高" });
  });

  it("AI-OUT-003: confidence未知値を拒否する", () => {
    expectFail({ ...makeValidReview(), confidence: "かなり高い" });
    const bad = makeValidReview();
    bad.rule_check[0] = {
      ...bad.rule_check[0],
    };
    const withBadSignal = {
      ...makeValidReview(),
      behavior_signals: [
        { signal: "高値追い", confidence: "very-high", reason: "画像より" },
      ],
    };
    expectFail(withBadSignal);
  });

  it("AI-OUT-004: 配列上限超過を拒否する(黙って切り捨てない)", () => {
    expectFail({
      ...makeValidReview(),
      confirmed_facts: ["a", "b", "c", "d", "e"],
    });
    expectFail({
      ...makeValidReview(),
      behavior_signals: [
        { signal: "s1", confidence: "low", reason: "r" },
        { signal: "s2", confidence: "low", reason: "r" },
        { signal: "s3", confidence: "low", reason: "r" },
      ],
    });
    expectFail({
      ...makeValidReview(),
      missing_information: ["a", "b", "c", "d", "e"],
    });
    const seven = makeValidReview();
    seven.rule_check = [
      ...seven.rule_check,
      { ...seven.rule_check[0], rule_id: "must_9" },
    ];
    expectFail(seven);
  });

  it("AI-OUT-005: rule_id不足を拒否する", () => {
    const v = makeValidReview();
    v.rule_check = v.rule_check.slice(0, 5);
    expectFail(v, "件数不一致");
  });

  it("AI-OUT-006: 入力にないrule_idを拒否する", () => {
    const v = makeValidReview();
    v.rule_check[5] = { ...v.rule_check[5], rule_id: "stop_9" };
    expectFail(v, "入力にないrule_id");
  });

  it("AI-OUT-007: rule_id重複を拒否する", () => {
    const v = makeValidReview();
    v.rule_check[1] = { ...v.rule_check[0] };
    expectFail(v, "重複");
  });

  it("AI-OUT-008: rule_text改変を拒否する", () => {
    const v = makeValidReview();
    v.rule_check[0] = {
      ...v.rule_check[0],
      rule_text: "上位足が上昇トレンドであること",
    };
    expectFail(v, "rule_text改変");
  });

  it("AI-OUT-009: rule_type改変を拒否する", () => {
    const v = makeValidReview();
    v.rule_check[0] = { ...v.rule_check[0], rule_type: "avoid" };
    expectFail(v);
  });

  it("AI-OUT-010: required評価方向", () => {
    // met / compliant → 成功(正常fixtureで担保済み)
    // met / violated → 失敗
    const v1 = makeValidReview();
    v1.rule_check[0] = { ...v1.rule_check[0], observation: "met", adherence: "violated" };
    expectFail(v1, "評価方向不正");
    // not_met / violated → 成功
    const v2 = makeValidReview();
    v2.rule_check[0] = { ...v2.rule_check[0], observation: "not_met", adherence: "violated" };
    v2.assessment = "violation";
    expect(validateReviewOutput(v2, rules).ok).toBe(true);
  });

  it("AI-OUT-011: avoid評価反転", () => {
    // met / violated → 成功
    const v1 = makeValidReview();
    v1.rule_check[3] = { ...v1.rule_check[3], observation: "met", adherence: "violated" };
    v1.assessment = "violation";
    expect(validateReviewOutput(v1, rules).ok).toBe(true);
    // met / compliant → 失敗(「発生を確認した」は遵守ではない)
    const v2 = makeValidReview();
    v2.rule_check[3] = { ...v2.rule_check[3], observation: "met", adherence: "compliant" };
    expectFail(v2, "評価方向不正");
    // not_met / compliant → 成功(正常fixtureで担保済み)
  });

  it("AI-OUT-012: invalidation評価(unknown/unknown含む)", () => {
    // met / violated → 成功
    const v1 = makeValidReview();
    v1.rule_check[5] = { ...v1.rule_check[5], observation: "met", adherence: "violated" };
    v1.assessment = "violation";
    expect(validateReviewOutput(v1, rules).ok).toBe(true);
    // not_met / compliant → 成功(fixture)
    // unknown / unknown → 成功
    const v2 = makeValidReview();
    v2.rule_check[5] = { ...v2.rule_check[5], observation: "unknown", adherence: "unknown" };
    expect(validateReviewOutput(v2, rules).ok).toBe(true);
  });

  it("AI-OUT-013: observation=unknown で adherence が unknown 以外は失敗", () => {
    const v1 = makeValidReview();
    v1.rule_check[5] = { ...v1.rule_check[5], observation: "unknown", adherence: "compliant" };
    expectFail(v1, "unknown");
    const v2 = makeValidReview();
    v2.rule_check[5] = { ...v2.rule_check[5], observation: "unknown", adherence: "violated" };
    expectFail(v2, "unknown");
  });

  it("AI-OUT-014: reflection_question空を拒否する", () => {
    expectFail({ ...makeValidReview(), reflection_question: "" });
    expectFail({ ...makeValidReview(), reflection_question: "   " });
  });

  it("AI-OUT-015: 指示表現・疑問文でないものを拒否する", () => {
    expectFail(
      { ...makeValidReview(), reflection_question: "次回は見送ってください" },
    );
    expectFail(
      { ...makeValidReview(), reflection_question: "損切りを設定してください" },
    );
    expectFail({
      ...makeValidReview(),
      reflection_question: "急騰時のルールを確認してみてくださいと思いますか？",
    });
    // 良い例(QUESTION-003)は通る
    const good = {
      ...makeValidReview(),
      reflection_question:
        "急騰時に見送る条件は、エントリー前に定義されていましたか？",
    };
    expect(validateReviewOutput(good, rules).ok).toBe(true);
  });

  it("追加プロパティ・必須欠落を拒否する(SCHEMA-006相当)", () => {
    const extra = { ...makeValidReview(), extra_field: "x" };
    expectFail(extra);
    const missing: Record<string, unknown> = { ...makeValidReview() };
    delete missing.reflection_question;
    expectFail(missing);
  });
});
