import { describe, expect, it } from "vitest";
import {
  deriveBlindIntegrity,
  parseReviewRequest,
  validateRuleIds,
} from "../dto";
import { detectResultWords } from "../resultWords";
import { makeSnapshot, TINY_JPEG_DATA_URL } from "./fixtures";

export function makeBody(): Record<string, unknown> {
  return {
    image: TINY_JPEG_DATA_URL,
    trade_at: "2026-07-14T09:30:00+09:00",
    trade_timezone: "Asia/Tokyo",
    pair: "USD/JPY",
    direction: "long",
    playbook_id: "pb-1",
    playbook_snapshot: makeSnapshot(),
    playbook_created_for_this_review: false,
    playbook_edited_for_this_review: false,
    entry_reason: "サポート到達後の反発を確認してエントリー",
    memory_source: "recorded_at_time",
    emotion_pre: "calm",
    result_word_detected: false,
    result_warning_overridden: false,
    image_blind_confirmed: true,
  };
}

describe("リクエストDTO(§4/§10.2)", () => {
  it("正常なDTOを受理する", () => {
    const r = parseReviewRequest(makeBody());
    expect(r.ok).toBe(true);
  });

  it("AI-REQ-002/004: result / pnl_pips / exit_reason / user_id キーを拒否する", () => {
    for (const [k, v] of [
      ["result", "win"],
      ["pnl_pips", 12.5],
      ["exit_reason", "利確"],
      ["user_id", "someone-else"],
    ] as const) {
      const r = parseReviewRequest({ ...makeBody(), [k]: v });
      expect(r.ok, `${k} は拒否されるべき`).toBe(false);
    }
  });

  it("FORM-001: 必須項目の欠落で実行不可", () => {
    for (const key of [
      "image",
      "trade_at",
      "trade_timezone",
      "pair",
      "direction",
      "playbook_id",
      "playbook_snapshot",
      "entry_reason",
      "memory_source",
      "image_blind_confirmed",
    ]) {
      const body = makeBody();
      delete body[key];
      expect(parseReviewRequest(body).ok, `${key} 欠落は拒否`).toBe(false);
    }
  });

  it("FORM-002: IANAタイムゾーンのみ受理する", () => {
    expect(
      parseReviewRequest({ ...makeBody(), trade_timezone: "JST" }).ok,
    ).toBe(false);
    expect(
      parseReviewRequest({ ...makeBody(), trade_timezone: "Asia/Tokyo" }).ok,
    ).toBe(true);
  });

  it("FORM-003: memory_source は2値のみ", () => {
    expect(
      parseReviewRequest({ ...makeBody(), memory_source: "guessed" }).ok,
    ).toBe(false);
    expect(
      parseReviewRequest({ ...makeBody(), memory_source: "from_memory" }).ok,
    ).toBe(true);
  });

  it("FORM-004: direction は long / short のみ", () => {
    expect(parseReviewRequest({ ...makeBody(), direction: "buy" }).ok).toBe(
      false,
    );
    expect(parseReviewRequest({ ...makeBody(), direction: "short" }).ok).toBe(
      true,
    );
  });

  it("FORM-005: emotion_pre は任意・5内部キーのみ", () => {
    const noEmotion = makeBody();
    delete noEmotion.emotion_pre;
    expect(parseReviewRequest(noEmotion).ok).toBe(true);
    expect(
      parseReviewRequest({ ...makeBody(), emotion_pre: "楽しい" }).ok,
    ).toBe(false);
    for (const e of ["calm", "rushed", "revenge", "excited", "anxious"]) {
      expect(parseReviewRequest({ ...makeBody(), emotion_pre: e }).ok).toBe(
        true,
      );
    }
  });

  it("IMG-008: image_blind_confirmed=true 以外は実行不可", () => {
    expect(
      parseReviewRequest({ ...makeBody(), image_blind_confirmed: false }).ok,
    ).toBe(false);
  });

  it("IMG-001: JPEG data URL以外を拒否する", () => {
    expect(
      parseReviewRequest({ ...makeBody(), image: "data:image/png;base64,AA" })
        .ok,
    ).toBe(false);
    expect(
      parseReviewRequest({ ...makeBody(), image: "data:text/plain;base64,AA" })
        .ok,
    ).toBe(false);
  });

  it("PB-002: 上限超過(required4/avoid3/stop2相当)を拒否する", () => {
    const snap = makeSnapshot();
    const over = {
      ...snap,
      must_rules: [
        ...snap.must_rules,
        { rule_id: "must_4", text: "4本目の条件" },
      ],
    };
    expect(
      parseReviewRequest({ ...makeBody(), playbook_snapshot: over }).ok,
    ).toBe(false);
    const overAvoid = {
      ...snap,
      avoid_rules: [
        ...snap.avoid_rules,
        { rule_id: "avoid_3", text: "3本目の見送り" },
      ],
    };
    expect(
      parseReviewRequest({ ...makeBody(), playbook_snapshot: overAvoid }).ok,
    ).toBe(false);
  });

  it("PB-001/PB-003: rule_id採番と最低1条件", () => {
    expect(validateRuleIds(makeSnapshot())).toBeNull();
    expect(
      validateRuleIds({ must_rules: [], avoid_rules: [], stop_rule: null }),
    ).toContain("最低1条件");
    // PB-004: 1件目がmust_2(欠番)は拒否
    expect(
      validateRuleIds({
        must_rules: [{ rule_id: "must_2", text: "条件" }],
        avoid_rules: [],
        stop_rule: null,
      }),
    ).toContain("must_1");
    expect(
      validateRuleIds({
        must_rules: [],
        avoid_rules: [],
        stop_rule: { rule_id: "stop_2", text: "条件" },
      }),
    ).toContain("stop_1");
  });

  it("1行1条件: 改行を含む条件を拒否する", () => {
    const snap = makeSnapshot();
    snap.must_rules[0] = { rule_id: "must_1", text: "条件1\n条件2" };
    expect(
      parseReviewRequest({ ...makeBody(), playbook_snapshot: snap }).ok,
    ).toBe(false);
  });

  it("FORM-006/007/008: blind_integrity の導出", () => {
    expect(deriveBlindIntegrity(false, false)).toBe("clean");
    expect(deriveBlindIntegrity(true, true)).toBe("warning_overridden");
    // 不整合な組み合わせは拒否(nullを返す)
    expect(deriveBlindIntegrity(true, false)).toBeNull();
    expect(deriveBlindIntegrity(false, true)).toBeNull();
  });

  it("結果語チェック(§4.5): 候補を検出するが削除はしない", () => {
    expect(detectResultWords("その後利確できた").length).toBeGreaterThan(0);
    expect(detectResultWords("損切りになった").length).toBeGreaterThan(0);
    expect(detectResultWords("結果的に伸びた").length).toBeGreaterThan(0);
    expect(detectResultWords("+30 pips取れた").length).toBeGreaterThan(0);
    expect(detectResultWords("サポート反発を確認してエントリー")).toHaveLength(
      0,
    );
  });
});
