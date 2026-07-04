export const VERDICTS = ["エッジ", "衝動", "混在"] as const;
export type Verdict = (typeof VERDICTS)[number];

export interface Review {
  verdict: Verdict;
  coach: string;
  critic: string;
  next_action: string;
  tags: string[];
}

export interface ReviewRequestBody {
  /** data URL (image/jpeg|png|webp)。クライアント側で長辺1280px程度にリサイズ済み */
  image: string;
  /** 履歴表示用サムネイル data URL (長辺460px程度・JPEG) */
  thumb?: string;
  memo: string;
  pair?: string;
  direction?: string;
  result?: string;
}

export interface ReviewResponseBody {
  review: Review;
  /** Supabase 未設定 or 未ログイン時は null(保存されない) */
  karteId: string | null;
  /** パターン検出の警告(例: 「高値掴みFOMO」:直近30日で3回目) */
  warnings: string[];
}

export function isVerdict(v: unknown): v is Verdict {
  return typeof v === "string" && (VERDICTS as readonly string[]).includes(v);
}
