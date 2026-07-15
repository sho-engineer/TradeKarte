import { NextResponse } from "next/server";
import { verifyAccessToken } from "./accessCookie";
import { executeReview, type AnthropicLike } from "./anthropic";
import {
  deriveBlindIntegrity,
  normalizeRules,
  parseReviewRequest,
  validateRuleIds,
} from "./dto";
import { PROMPT_VERSION, REVIEW_SCHEMA_VERSION } from "./prompt";
import type { KarteInit, RunStore } from "./store";

// /api/review の中核(機能設計書 v3.3 §10.2 保存順)。
// テストのため依存(ストア・Anthropicクライアント・セッション解決)を注入する。

export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_SECONDS = 60;

export interface ReviewDeps {
  store: RunStore;
  /** Supabaseセッションからuser_idを取得(本文からは受け取らない) */
  getUserId(request: Request): Promise<string | null>;
  client: AnthropicLike;
  model: string;
  /** アクセスCookieの検証(注入可能にしてテスト容易化) */
  verifyAccess?(request: Request): Promise<boolean>;
}

/** リクエストのCookieヘッダからアクセスコードCookieを検証する */
export async function verifyAccessFromRequest(
  request: Request,
): Promise<boolean> {
  const secret = process.env.APP_ACCESS_COOKIE_SECRET ?? "";
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = /(?:^|;\s*)pojimiru_access=([^;]+)/.exec(cookieHeader);
  return verifyAccessToken(secret, match?.[1] ?? null);
}

export async function handleReview(
  deps: ReviewDeps,
  request: Request,
): Promise<NextResponse> {
  // 1. アクセスコードCookie検証(§2.1)。失敗時はAnthropicも run 作成もなし
  const accessOk = await (deps.verifyAccess ?? verifyAccessFromRequest)(request);
  if (!accessOk) {
    return NextResponse.json(
      { error: "アクセスコードが必要です" },
      { status: 403 },
    );
  }

  // 2. Supabaseセッション確認。user_id はセッション由来のみ(AUTH-002)
  const userId = await deps.getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 3. リクエストDTO検証(strict: 結果・user_id等の未知キーは拒否)
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }
  const dto = parseReviewRequest(body);
  if (!dto.ok) {
    return NextResponse.json({ error: dto.message }, { status: 400 });
  }
  const req = dto.value;

  const ruleIdError = validateRuleIds(req.playbook_snapshot);
  if (ruleIdError) {
    return NextResponse.json({ error: ruleIdError }, { status: 400 });
  }

  const blindIntegrity = deriveBlindIntegrity(
    req.result_word_detected,
    req.result_warning_overridden,
  );
  if (!blindIntegrity) {
    return NextResponse.json(
      { error: "結果語フラグの組み合わせが不正です" },
      { status: 400 },
    );
  }

  // レート制限: API呼び出し前に拒否。超過時は run も作らない(RATE-002)
  const recent = await deps.store.countRecentRuns(
    userId,
    RATE_LIMIT_WINDOW_SECONDS,
  );
  if (recent >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。1分ほど待って再試行してください" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // 再実行・改訂の対象カルテは所有者を確認(REV-003)
  if (req.rerun_of_karte_id) {
    const owns = await deps.store.karteBelongsToUser(
      req.rerun_of_karte_id,
      userId,
    );
    if (!owns) {
      return NextResponse.json(
        { error: "対象のカルテが見つかりません" },
        { status: 404 },
      );
    }
  }
  if (req.revision_of) {
    const owns = await deps.store.karteBelongsToUser(req.revision_of, userId);
    if (!owns) {
      return NextResponse.json(
        { error: "対象のカルテが見つかりません" },
        { status: 404 },
      );
    }
  }

  // 4. run を running / karte_id=null で作成
  const { runId } = await deps.store.createRunning({
    userId,
    modelId: deps.model,
    promptVersion: PROMPT_VERSION,
    schemaVersion: REVIEW_SCHEMA_VERSION,
    experimentId: req.experiment_id,
  });

  // 5-6. Anthropic実行 + HTTP / stop_reason / Structured Outputs / Zod /
  //      rule mapping 検証(executeReview 内)
  const rules = normalizeRules(req.playbook_snapshot);
  const result = await executeReview(
    deps.client,
    {
      croppedImageDataUrl: req.image,
      pair: req.pair,
      direction: req.direction,
      rules,
      entryReason: req.entry_reason,
    },
    deps.model,
  );

  // 7. 失敗: run を failed へ。karte は作らない
  if (!result.ok) {
    await deps.store.markFailed(runId, {
      stage: result.stage,
      message: result.message,
      httpStatus: result.httpStatus,
      stopReason: result.stopReason,
      latencyMs: result.latencyMs,
      rawResponseText: result.rawResponseText,
    });
    return NextResponse.json(
      {
        error: "レビューの生成に失敗しました。再試行してください",
        failure_stage: result.stage,
        run_id: runId,
        retryable: true,
      },
      { status: 502 },
    );
  }

  const meta = {
    stopReason: result.stopReason,
    latencyMs: result.latencyMs,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    estimatedCostYen: result.estimatedCostYen,
    rawResponseText: result.rawResponseText,
    parsedResponse: result.review,
  };

  // 9. 再実行・モデル比較: 新しいkarteを作らず既存karteへ関連付け
  if (req.rerun_of_karte_id) {
    await deps.store.attachNonCanonical(runId, req.rerun_of_karte_id, meta);
    return NextResponse.json({
      karte_id: req.rerun_of_karte_id,
      run_id: runId,
      is_canonical: false,
      review: result.review,
    });
  }

  // 8. 初回成功: karte作成とrun確定を同一トランザクションで(RPC相当)
  const karte: KarteInit = {
    userId,
    tradeAt: req.trade_at,
    tradeTimezone: req.trade_timezone,
    pair: req.pair,
    direction: req.direction,
    playbookId: req.playbook_id,
    playbookSnapshot: req.playbook_snapshot,
    playbookCreatedForThisReview: req.playbook_created_for_this_review,
    playbookEditedForThisReview: req.playbook_edited_for_this_review,
    entryReason: req.entry_reason,
    memorySource: req.memory_source,
    emotionPre: req.emotion_pre ?? null,
    resultWordDetected: req.result_word_detected,
    resultWarningOverridden: req.result_warning_overridden,
    imageBlindConfirmed: true,
    blindIntegrity,
    revisionOf: req.revision_of ?? null,
    review: result.review,
  };

  try {
    const { karteId } = await deps.store.finalizeCanonical(runId, karte, meta);
    return NextResponse.json({
      karte_id: karteId,
      run_id: runId,
      is_canonical: true,
      blind_integrity: blindIntegrity,
      review: result.review,
    });
  } catch {
    await deps.store.markFailed(runId, {
      stage: "database",
      message: "カルテの保存に失敗しました",
      latencyMs: result.latencyMs,
    });
    return NextResponse.json(
      {
        error: "カルテの保存に失敗しました。再試行してください",
        failure_stage: "database",
        run_id: runId,
        retryable: true,
      },
      { status: 500 },
    );
  }
}
