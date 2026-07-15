import { NextResponse } from "next/server";

/**
 * F2: 約定履歴スクショ読み取り — Phase 1.5(継続率確認後に実装)
 *
 * 設計: docs/feature-design-v2.md「F2｜約定履歴スクショ読み取り」参照。
 * - レビューAPIとは責務分離した別エンドポイント(抽出だけやり直せるように)
 * - モデルは claude-haiku-4-5(構造化抽出はHaikuで十分。コスト最小化)
 * - 複数トレードが写っていれば配列で全件返し、UI側で1件選択(1カルテ=1トレード)
 * - 抽出結果はフォームに反映してユーザーが修正可能にする(無検証で確定しない)
 * - プライバシー: 履歴画像は既定で保存しない(抽出後破棄)。record_image_url はオプトイン
 * - 抽出した pnl 系の値はレビューAPIのプロンプトへ渡さない(判定は損益と独立)
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "約定履歴の読み取りは未実装です(Phase 1.5)。docs/feature-design-v2.md の F2 を参照。",
    },
    { status: 501 },
  );
}
