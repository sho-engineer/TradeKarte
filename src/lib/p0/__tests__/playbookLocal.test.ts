import { describe, expect, it } from "vitest";
import {
  createNewVersion,
  createPlaybook,
  draftToRules,
  latestPlaybooks,
  validateDraft,
  type PlaybookDraft,
} from "../playbookLocal";

// プレイブックのバージョン管理と上限(§3.2〜3.4 / PB-001〜003, PB-007相当)

function draft(overrides: Partial<PlaybookDraft> = {}): PlaybookDraft {
  return {
    name: "押し目買い",
    must: ["上位足が上昇トレンド", "サポートへ到達"],
    avoid: ["急騰直後は見送る"],
    stop: "直近安値を明確に下抜けたら無効",
    ...overrides,
  };
}

describe("playbookLocal(§3)", () => {
  it("PB-003: rule_id を must_1..3 / avoid_1..2 / stop_1 で採番する", () => {
    const rules = draftToRules(draft());
    expect(rules.must_rules.map((r) => r.rule_id)).toEqual([
      "must_1",
      "must_2",
    ]);
    expect(rules.avoid_rules.map((r) => r.rule_id)).toEqual(["avoid_1"]);
    expect(rules.stop_rule?.rule_id).toBe("stop_1");
  });

  it("空行・空白行は詰めて採番する(欠番を作らない)", () => {
    const rules = draftToRules(
      draft({ must: ["", "上位足が上昇トレンド", "  "], avoid: [] }),
    );
    expect(rules.must_rules).toEqual([
      { rule_id: "must_1", text: "上位足が上昇トレンド" },
    ]);
  });

  it("PB-001: 全条件が空なら拒否", () => {
    expect(
      validateDraft(draft({ must: [], avoid: [], stop: null })),
    ).toBeTruthy();
  });

  it("PB-002: must>3 / avoid>2 は拒否・6条件フルは許可", () => {
    expect(
      validateDraft(draft({ must: ["a", "b", "c", "d"] })),
    ).toBeTruthy();
    expect(
      validateDraft(draft({ avoid: ["a", "b", "c"] })),
    ).toBeTruthy();
    expect(
      validateDraft(
        draft({ must: ["a", "b", "c"], avoid: ["d", "e"], stop: "f" }),
      ),
    ).toBeNull();
  });

  it("1行1条件: 条件内の改行は拒否", () => {
    expect(validateDraft(draft({ must: ["1行目\n2行目"] }))).toBeTruthy();
  });

  it("PB-007: 編集は新版を作り、元は不変・version+1・previous_version_id", () => {
    const v1 = createPlaybook(draft(), "pb-1", "2026-07-01T00:00:00Z");
    const v1Snapshot = JSON.stringify(v1);

    const v2 = createNewVersion(
      v1,
      draft({ must: ["上位足が上昇トレンド", "サポートへ到達", "反発を確認"] }),
      "pb-2",
      "2026-07-02T00:00:00Z",
    );
    expect(v2.version).toBe(2);
    expect(v2.previous_version_id).toBe("pb-1");
    expect(v2.rules.must_rules).toHaveLength(3);
    // 元の行は変更しない(§3.4)
    expect(JSON.stringify(v1)).toBe(v1Snapshot);
  });

  it("latestPlaybooks は新版へ置き換えられた版を隠す", () => {
    const v1 = createPlaybook(draft(), "pb-1", "2026-07-01T00:00:00Z");
    const v2 = createNewVersion(v1, draft(), "pb-2", "2026-07-02T00:00:00Z");
    const other = createPlaybook(
      draft({ name: "ブレイクアウト" }),
      "pb-3",
      "2026-07-03T00:00:00Z",
    );
    const latest = latestPlaybooks([v1, v2, other]);
    expect(latest.map((p) => p.id).sort()).toEqual(["pb-2", "pb-3"]);
  });
});
