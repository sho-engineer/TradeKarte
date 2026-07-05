import type { Review } from "./types";

/** APIキーを使わず固定レビューを返す開発/デモ用モード(MOCK_REVIEW=1) */
export function isMockMode(): boolean {
  return process.env.MOCK_REVIEW === "1";
}

export function mockReview(): Review {
  return {
    verdict: "混在",
    coach:
      "レンジ上抜けという環境認識自体は妥当で、上位足の方向とも整合しています。エントリー位置もブレイク直後で、根拠のあるトレードだったと言えます。",
    critic:
      "「2連敗を取り返したい」という記述からリベンジ心理が混入していた可能性が高く、本来待つべき押し目を待てていません。負けであれば確率の負けではなく、待てなかった分の判断の負けに寄っています。",
    next_action:
      "次回は同じ状況でも、エントリー前に「今の動機は根拠か感情か」を一度言語化する習慣を持つ。",
    tags: ["USD/JPY", "東京時間", "レンジブレイク", "リベンジ"],
  };
}
