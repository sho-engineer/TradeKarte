import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  generateReview,
  pickPromptFields,
  ReviewError,
  type ImageMediaType,
} from "@/lib/review/claude";
import { isMockMode, mockReview } from "@/lib/review/mock";
import type { ReviewRequestBody, ReviewResponseBody } from "@/lib/review/types";
import { detectPatterns, patternWindowStart } from "@/lib/pattern";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_MEDIA_TYPES: ImageMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
// 長辺1280px/JPEG q0.85 なら余裕をもって収まるサイズ
const MAX_IMAGE_BASE64_LENGTH = 8_000_000;
const THUMB_BUCKET = "karte-thumbs";

function freeMonthlyLimit(): number {
  const n = Number(process.env.FREE_MONTHLY_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

function parseDataUrl(
  dataUrl: string,
): { mediaType: ImageMediaType; base64: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl,
  );
  if (!match) return null;
  return { mediaType: match[1] as ImageMediaType, base64: match[2] };
}

export async function POST(request: NextRequest) {
  let body: ReviewRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエスト形式が不正です。" },
      { status: 400 },
    );
  }

  if (typeof body.image !== "string" || body.image.length === 0) {
    return NextResponse.json(
      { error: "チャート画像を添付してください。" },
      { status: 400 },
    );
  }
  if (body.image.length > MAX_IMAGE_BASE64_LENGTH) {
    return NextResponse.json(
      { error: "画像サイズが大きすぎます。" },
      { status: 413 },
    );
  }
  const image = parseDataUrl(body.image);
  if (!image || !ALLOWED_MEDIA_TYPES.includes(image.mediaType)) {
    return NextResponse.json(
      { error: "画像は JPEG / PNG / WebP のみ対応しています。" },
      { status: 400 },
    );
  }

  // プロンプトに渡すのはホワイトリスト済みの項目のみ(損益系は判定と独立の原則で混入させない)
  const fields = pickPromptFields(body);

  // Supabase 設定済みなら認証+無料枠チェック。未設定なら保存なしのお試しモードで動作。
  const supabaseEnabled = isSupabaseConfigured();
  const supabase = supabaseEnabled ? await createClient() : null;
  let userId: string | null = null;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "ログインが必要です。" },
        { status: 401 },
      );
    }
    userId = user.id;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { count, error: countError } = await supabase
      .from("karte")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart.toISOString());
    if (countError) {
      return NextResponse.json(
        { error: "利用状況の確認に失敗しました。" },
        { status: 500 },
      );
    }
    if ((count ?? 0) >= freeMonthlyLimit()) {
      return NextResponse.json(
        {
          error: `無料プランの月${freeMonthlyLimit()}回の上限に達しました。来月までお待ちいただくか、アップグレードをご検討ください。`,
          limitReached: true,
        },
        { status: 429 },
      );
    }
  }

  let review;
  try {
    review = isMockMode()
      ? mockReview(fields.emotionPre)
      : await generateReview({
          imageMediaType: image.mediaType,
          imageBase64: image.base64,
          ...fields,
        });
  } catch (err) {
    if (err instanceof ReviewError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "AI APIキーが未設定または無効です(ANTHROPIC_API_KEY)。" },
        { status: 500 },
      );
    }
    if (
      err instanceof Anthropic.RateLimitError ||
      err instanceof Anthropic.InternalServerError
    ) {
      return NextResponse.json(
        { error: "AIが混み合っています。しばらくしてから再試行してください。" },
        { status: 503 },
      );
    }
    console.error("review generation failed:", err);
    return NextResponse.json(
      { error: "レビューの生成に失敗しました。" },
      { status: 500 },
    );
  }

  let karteId: string | null = null;
  let warnings: string[] = [];

  if (supabase && userId) {
    // 履歴用サムネイルを保存(失敗してもカルテ保存は続行)
    let thumbPath: string | null = null;
    const thumb = body.thumb ? parseDataUrl(body.thumb) : null;
    if (thumb && body.thumb!.length <= MAX_IMAGE_BASE64_LENGTH) {
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(THUMB_BUCKET)
        .upload(path, Buffer.from(thumb.base64, "base64"), {
          contentType: thumb.mediaType,
        });
      if (!uploadError) thumbPath = path;
      else console.error("thumbnail upload failed:", uploadError.message);
    }

    // F4(行動連鎖)用に直前カルテと通し番号をサーバー側で自動設定
    const { data: prev } = await supabase
      .from("karte")
      .select("id, seq")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: inserted, error: insertError } = await supabase
      .from("karte")
      .insert({
        user_id: userId,
        image_thumb_url: thumbPath,
        pair: fields.pair ?? null,
        direction: fields.direction ?? null,
        result: fields.result ?? null,
        memo: fields.memo,
        emotion_pre: fields.emotionPre ?? null,
        verdict: review.verdict,
        emotion_gap: review.emotion_gap,
        coach: review.coach,
        critic: review.critic,
        next_action: review.next_action,
        tags: review.tags,
        prev_karte_id: prev?.id ?? null,
        seq: (prev?.seq ?? 0) + 1,
      })
      .select("id")
      .single();
    if (insertError) {
      console.error("karte insert failed:", insertError.message);
    } else {
      karteId = inserted.id;
    }

    const { data: history } = await supabase
      .from("karte")
      .select("tags, verdict, emotion_gap")
      .eq("user_id", userId)
      .gte("created_at", patternWindowStart())
      .neq("id", karteId ?? "00000000-0000-0000-0000-000000000000");
    warnings = detectPatterns(
      { tags: review.tags, verdict: review.verdict, emotionGap: review.emotion_gap },
      history ?? [],
    );
  }

  const responseBody: ReviewResponseBody = { review, karteId, warnings };
  return NextResponse.json(responseBody);
}
