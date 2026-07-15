import type { SupabaseClient } from "@supabase/supabase-js";

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

/**
 * per-user のバースト制限(例: 直近60秒に5回まで)。月間の無料枠カウントとは別物 —
 * こちらは短時間の連打・スクリプト濫用からAPIコストを守るための簡易ガード。
 * karte テーブルへの直近保存件数で判定するため、認証済みユーザーにのみ適用できる。
 */
export async function checkBurstRateLimit(
  supabase: SupabaseClient,
  userId: string,
  { maxRequests = 5, windowSeconds = 60 } = {},
): Promise<RateLimitResult> {
  const windowStart = new Date(
    Date.now() - windowSeconds * 1000,
  ).toISOString();
  const { count } = await supabase
    .from("karte")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart);
  return {
    limited: (count ?? 0) >= maxRequests,
    retryAfterSeconds: windowSeconds,
  };
}
