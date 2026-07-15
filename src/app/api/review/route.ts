import Anthropic from "@anthropic-ai/sdk";
import { getModelId, type AnthropicLike } from "@/lib/p0/anthropic";
import {
  handleReview,
  verifyAccessFromRequest,
} from "@/lib/p0/reviewHandler";
import { getRunStore } from "@/lib/p0/store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// AIレビュー実行(機能設計書 v3.3 §10.2)。中核は reviewHandler.ts。
// ANTHROPIC_API_KEY はサーバーのみで使用し、クライアントへ露出しない。

async function getUserIdFromSession(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function POST(request: Request) {
  // アクセスコード検証を最優先(ACCESS-004: 未認可では設定状態も返さない)
  if (!(await verifyAccessFromRequest(request))) {
    return NextResponse.json(
      { error: "アクセスコードが必要です" },
      { status: 403 },
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が未設定です" },
      { status: 503 },
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase が未設定です" },
      { status: 503 },
    );
  }

  const client = new Anthropic() as unknown as AnthropicLike;
  return handleReview(
    {
      store: getRunStore(),
      getUserId: () => getUserIdFromSession(),
      client,
      model: getModelId(),
    },
    request,
  );
}
