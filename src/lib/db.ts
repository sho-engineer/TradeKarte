export interface KarteRow {
  id: string;
  created_at: string;
  image_thumb_url: string | null;
  pair: string | null;
  direction: string | null;
  result: string | null;
  memo: string | null;
  verdict: string;
  coach: string;
  critic: string;
  next_action: string;
  tags: string[];
}

export const THUMB_BUCKET = "karte-thumbs";

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
