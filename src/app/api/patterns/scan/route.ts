import { NextResponse } from "next/server";

/**
 * F4: 行動連鎖パターン検出 — Phase 2(スキーマのみ初日から対応済み)
 *
 * 設計: docs/feature-design-v2.md「F4｜行動連鎖パターン検出」参照。
 * - カルテ保存後に非同期で本エンドポイントを叩き、検出結果を pattern_alert に保存
 *   → 次回カルテ表示時にバナー表示
 * - 検出ルールは最初はハードコードで4つだけ(MLは不要)。
 *   同一ユーザー・直近30日、prev_karte_id を辿る単純クエリで実装可能:
 *   1. revenge_chain      直前result=負け → 次verdict=衝動 がN回
 *   2. win_overconfidence 直前result=勝ち → 次verdict=衝動 がN回
 *   3. gap_repeat         emotion_gap=true がN回
 *   4. tag_repeat         同一tagsを含む衝動判定がN回
 * - Free/Pro の出し分け: Free は「繰り返しパターンを検出」までで中身はぼかす。
 *   Pro で全文+履歴リンク(課金トリガーの本体)
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "行動連鎖パターン検出は未実装です(Phase 2)。docs/feature-design-v2.md の F4 を参照。",
    },
    { status: 501 },
  );
}
