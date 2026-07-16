import { handleKarteResult } from "@/lib/p0/karteHandler";
import { getRunStore } from "@/lib/p0/store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

// 結果の後入力(機能設計書 v3.3 §12)。中核は karteHandler.ts。
// AIを再実行せず、assessmentを変更せず、revisionを作らない。

async function getUserIdFromSession(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleKarteResult(
    { store: getRunStore(), getUserId: () => getUserIdFromSession() },
    request,
    id,
  );
}
