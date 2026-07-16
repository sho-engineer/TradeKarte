import { handleKarteFeedback } from "@/lib/p0/karteHandler";
import { getRunStore } from "@/lib/p0/store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

// 構造化フィードバック(機能設計書 v3.3 §13)。中核は karteHandler.ts。

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
  return handleKarteFeedback(
    { store: getRunStore(), getUserId: () => getUserIdFromSession() },
    request,
    id,
  );
}
