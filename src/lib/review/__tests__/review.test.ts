import { describe, expect, it } from "vitest";
import { buildUserText, parseReview, pickPromptFields } from "../claude";
import { detectPatterns } from "../../pattern";

describe("判定と損益の独立(pnl系はレビュープロンプトに混入しない)", () => {
  // F2 で抽出される損益系フィールドがボディに紛れ込んでいても、
  // pickPromptFields のホワイトリストを通る限りプロンプトへ到達しないこと。
  const dirtyBody = {
    memo: "東京時間のブレイクでロング。",
    pair: "USD/JPY",
    direction: "ロング",
    result: "負け",
    emotion_pre: "冷静",
    // ↓ プロンプトに入ってはいけない値たち
    pnl_pips: -123.4,
    pnl_yen: -56789,
    entry_price: 151.234,
    exit_price: 150.0,
    lot: 2.5,
    trade_at: "2026-07-01T09:30:00+09:00",
  };

  it("pickPromptFields はホワイトリストの項目しか返さない", () => {
    const fields = pickPromptFields(dirtyBody);
    expect(Object.keys(fields).sort()).toEqual([
      "direction",
      "emotionPre",
      "memo",
      "pair",
      "result",
    ]);
  });

  it("プロンプト本文に損益系の値・語が一切現れない", () => {
    const text = buildUserText(pickPromptFields(dirtyBody));
    for (const forbidden of [
      "123.4",
      "56789",
      "151.234",
      "150.0",
      "2.5",
      "2026-07-01",
      "pnl",
      "pips",
      "lot",
    ]) {
      expect(text).not.toContain(forbidden);
    }
    // 「結果」は渡すが、判定に使わない注記が付くこと
    expect(text).toContain("結果: 負け");
    expect(text).toContain("判定の根拠に使わないこと");
  });

  it("自己申告感情はプロンプトに1行で入る(未申告は「未申告」)", () => {
    expect(buildUserText(pickPromptFields(dirtyBody))).toContain(
      "エントリー前の自己申告感情: 冷静",
    );
    expect(buildUserText(pickPromptFields({ memo: "x" }))).toContain(
      "エントリー前の自己申告感情: 未申告",
    );
  });

  it("emotion_pre は5択以外を受け付けない", () => {
    expect(
      pickPromptFields({ memo: "x", emotion_pre: "無敵" }).emotionPre,
    ).toBeUndefined();
    expect(
      pickPromptFields({ memo: "x", emotion_pre: "取り返したい" }).emotionPre,
    ).toBe("取り返したい");
  });
});

describe("parseReview", () => {
  const base = {
    verdict: "衝動",
    coach: "c",
    critic: "k",
    next_action: "n",
    tags: ["USD/JPY", "リベンジ"],
  };

  it("emotion_gap を boolean として取り込む", () => {
    expect(parseReview(JSON.stringify({ ...base, emotion_gap: true })).emotion_gap).toBe(true);
    expect(parseReview(JSON.stringify({ ...base, emotion_gap: false })).emotion_gap).toBe(false);
  });

  it("emotion_gap 欠落時は false に倒す(旧形式との互換)", () => {
    expect(parseReview(JSON.stringify(base)).emotion_gap).toBe(false);
  });

  it("verdict が不正なら例外", () => {
    expect(() =>
      parseReview(JSON.stringify({ ...base, verdict: "様子見" })),
    ).toThrow();
  });

  it("タグは4個までに切り詰める", () => {
    const r = parseReview(
      JSON.stringify({ ...base, tags: ["a", "b", "c", "d", "e"] }),
    );
    expect(r.tags).toHaveLength(4);
  });
});

describe("detectPatterns(F1: 認識ズレ反復)", () => {
  it("emotion_gap=true が直近30日で3回目なら警告", () => {
    const warnings = detectPatterns(
      { tags: [], verdict: "エッジ", emotionGap: true },
      [
        { tags: [], verdict: "衝動", emotion_gap: true },
        { tags: [], verdict: "混在", emotion_gap: true },
        { tags: [], verdict: "エッジ", emotion_gap: false },
      ],
    );
    expect(warnings.some((w) => w.includes("ズレ") && w.includes("3回目"))).toBe(
      true,
    );
  });

  it("2回目までは警告しない / gapなしなら数えない", () => {
    expect(
      detectPatterns({ tags: [], verdict: "エッジ", emotionGap: true }, [
        { tags: [], verdict: "衝動", emotion_gap: true },
      ]),
    ).toHaveLength(0);
    expect(
      detectPatterns({ tags: [], verdict: "エッジ", emotionGap: false }, [
        { tags: [], verdict: "衝動", emotion_gap: true },
        { tags: [], verdict: "衝動", emotion_gap: true },
        { tags: [], verdict: "衝動", emotion_gap: true },
      ]),
    ).toHaveLength(0);
  });
});
