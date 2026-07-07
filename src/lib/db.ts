export interface KarteRow {
  id: string;
  created_at: string;
  trade_at: string | null;
  image_thumb_url: string | null;
  record_image_url: string | null;
  pair: string | null;
  direction: string | null;
  result: string | null;
  /** 表示・統計用。AIレビューのプロンプトには渡さない(判定は損益と独立) */
  pnl_pips: number | null;
  memo: string | null;
  emotion_pre: string | null;
  verdict: string;
  emotion_gap: boolean | null;
  coach: string;
  critic: string;
  next_action: string;
  tags: string[];
  prev_karte_id: string | null;
  seq: number | null;
}

export const THUMB_BUCKET = "karte-thumbs";

/** 台帳用のカルテ番号(例: TK-20260731-014) */
export function formatRecordNo(createdAt: string, seq: number | null): string {
  const d = new Date(createdAt);
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  return seq != null
    ? `TK-${date}-${String(seq).padStart(3, "0")}`
    : `TK-${date}`;
}

export function formatJst(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
