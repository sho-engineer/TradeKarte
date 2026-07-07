export const VERDICTS = ["エッジ", "衝動", "混在"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** F1: エントリー前の自己申告感情(5つ固定・任意) */
export const EMOTIONS = [
  { value: "冷静", emoji: "😌" },
  { value: "焦り", emoji: "😰" },
  { value: "取り返したい", emoji: "😤" },
  { value: "興奮", emoji: "🤩" },
  { value: "不安", emoji: "😟" },
] as const;
export type Emotion = (typeof EMOTIONS)[number]["value"];
export const EMOTION_VALUES = EMOTIONS.map((e) => e.value) as readonly string[];

export interface Review {
  verdict: Verdict;
  coach: string;
  critic: string;
  next_action: string;
  tags: string[];
  /** F1: 自己申告感情と実際の行動の乖離(未申告時は false) */
  emotion_gap: boolean;
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
  /** F1: 自己申告感情(EMOTIONS のいずれか) */
  emotion_pre?: string;
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
