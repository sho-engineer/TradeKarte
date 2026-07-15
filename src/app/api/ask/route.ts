import { NextResponse } from "next/server";

/**
 * F3: 自然言語質問 "Ask Karte" — Phase 2(Pro限定)
 *
 * 設計: docs/feature-design-v2.md「F3｜自然言語質問」参照。
 * - RAGではなく「SQL集計→要約」の2段構え
 *   Step A: Haiku が質問文を集計仕様JSONに変換(利用可能な集計軸のみ)
 *   Step B: 仕様JSONをサーバー側で検証し、ホワイトリスト化した集計クエリのみ
 *           パラメタライズドクエリで実行(生成SQLは直接実行しない)
 *   Step C: 集計結果を Sonnet が日本語2〜4文+根拠数字で要約
 * - system prompt 制約: 回答は過去データの記述のみ。今後の売買への示唆・予測・推奨は出さない
 * - 回数制限: Pro=月30回 / Free=不可(ロックUIは見せて課金導線にする)
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Ask Karte は未実装です(Phase 2・Pro限定)。docs/feature-design-v2.md の F3 を参照。",
    },
    { status: 501 },
  );
}
