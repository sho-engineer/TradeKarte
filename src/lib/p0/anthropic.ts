import {
  buildUserText,
  SYSTEM_PROMPT,
  type ReviewPromptInput,
} from "./prompt";
import { reviewJsonSchema, validateReviewOutput } from "./schema";
import type { FailureStage, ReviewOutput } from "./types";

// Anthropic Messages API の呼び出し層。
// - モデルIDは env(ANTHROPIC_MODEL)経由のみ。コードへ直書きしない
// - Structured Outputs は現行形 output_config.format(旧output_format不使用)
// - stop_reason は end_turn のみ成功。refusal / max_tokens は失敗(§8.1/§9.2)

/** 非ストリーミングで JSON 出力+adaptive thinking に十分な余裕(§9注意点) */
const MAX_TOKENS = 16000;

export function getModelId(): string {
  const model = process.env.ANTHROPIC_MODEL;
  if (!model) throw new Error("ANTHROPIC_MODEL が未設定です");
  return model;
}

/** data URL (image/jpeg) を base64 ソースへ分解する */
function parseDataUrl(dataUrl: string): { mediaType: "image/jpeg"; data: string } {
  const m = /^data:(image\/jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error("クロップ済み画像は image/jpeg の data URL が必要です");
  return { mediaType: "image/jpeg", data: m[2] };
}

/**
 * AIリクエストのpayloadを組み立てる(ホワイトリスト方式)。
 * 引数型 ReviewPromptInput に result / pnl_pips / exit_reason / emotion_pre /
 * user_id は存在せず、余分なプロパティが渡されてもここでは一切参照しない
 * (AI-REQ-001〜005)。
 */
export function buildReviewPayload(input: ReviewPromptInput, model: string) {
  const image = parseDataUrl(input.croppedImageDataUrl);
  return {
    model,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    output_config: {
      format: {
        type: "json_schema" as const,
        schema: reviewJsonSchema,
      },
    },
    messages: [
      {
        role: "user" as const,
        content: [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: image.mediaType,
              data: image.data,
            },
          },
          {
            type: "text" as const,
            text: buildUserText({
              pair: input.pair,
              direction: input.direction,
              rules: input.rules,
              entryReason: input.entryReason,
            }),
          },
        ],
      },
    ],
  };
}

/** テスト注入可能な最小クライアント形 */
export interface AnthropicLike {
  messages: {
    create(params: ReturnType<typeof buildReviewPayload>): Promise<{
      content: { type: string; text?: string }[];
      stop_reason: string | null;
      model: string;
      usage: { input_tokens: number; output_tokens: number };
    }>;
  };
}

export type ReviewExecution =
  | {
      ok: true;
      review: ReviewOutput;
      modelId: string;
      stopReason: string;
      latencyMs: number;
      inputTokens: number;
      outputTokens: number;
      estimatedCostYen: number;
      /** 監査ログ用。画像・リクエスト本文は含まない(§10.4) */
      rawResponseText: string;
    }
  | {
      ok: false;
      stage: FailureStage;
      message: string;
      httpStatus?: number;
      stopReason?: string;
      latencyMs: number;
      modelId: string;
      rawResponseText?: string;
    };

/** モデル別の概算単価(USD / 1Mトークン)。即時レビューは通常API料金(§15設計書) */
const PRICE_USD_PER_MTOK: { prefix: string; input: number; output: number }[] = [
  { prefix: "claude-sonnet-5", input: 3, output: 15 },
  { prefix: "claude-sonnet-4-6", input: 3, output: 15 },
  { prefix: "claude-opus-4-8", input: 5, output: 25 },
];

export function estimateCostYen(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = PRICE_USD_PER_MTOK.find((p) => model.startsWith(p.prefix));
  if (!price) return 0;
  const usd =
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output;
  const rate = Number(process.env.COST_USD_JPY ?? "150");
  return Math.round(usd * rate * 100) / 100;
}

function statusOf(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status: unknown }).status;
    if (typeof s === "number") return s;
  }
  return undefined;
}

/**
 * AIレビューを実行し、HTTP / stop_reason / Structured Outputs / Zod /
 * rule mapping を検証する。失敗は failure_stage 付きで返す(§10.1)。
 */
export async function executeReview(
  client: AnthropicLike,
  input: ReviewPromptInput,
  model: string = getModelId(),
): Promise<ReviewExecution> {
  const payload = buildReviewPayload(input, model);
  const startedAt = Date.now();

  let response: Awaited<ReturnType<AnthropicLike["messages"]["create"]>>;
  try {
    response = await client.messages.create(payload);
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const httpStatus = statusOf(err);
    if (httpStatus !== undefined) {
      return {
        ok: false,
        stage: "anthropic_http",
        message: `Anthropic APIエラー (HTTP ${httpStatus})`,
        httpStatus,
        latencyMs,
        modelId: model,
      };
    }
    return {
      ok: false,
      stage: "network",
      message: "Anthropic APIへ接続できませんでした",
      latencyMs,
      modelId: model,
    };
  }
  const latencyMs = Date.now() - startedAt;
  const stopReason = response.stop_reason ?? "unknown";
  const textBlock = response.content.find((b) => b.type === "text");
  const rawResponseText = textBlock?.text ?? "";

  if (stopReason === "refusal") {
    return {
      ok: false,
      stage: "refusal",
      message: "モデルが応答を拒否しました",
      stopReason,
      latencyMs,
      modelId: response.model,
      rawResponseText,
    };
  }
  if (stopReason === "max_tokens") {
    return {
      ok: false,
      stage: "max_tokens",
      message: "出力がトークン上限で途切れました",
      stopReason,
      latencyMs,
      modelId: response.model,
      rawResponseText,
    };
  }
  if (stopReason !== "end_turn") {
    return {
      ok: false,
      stage: "unknown",
      message: `想定外のstop_reason: ${stopReason}`,
      stopReason,
      latencyMs,
      modelId: response.model,
      rawResponseText,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponseText);
  } catch {
    return {
      ok: false,
      stage: "structured_output",
      message: "出力がJSONとして解釈できません",
      stopReason,
      latencyMs,
      modelId: response.model,
      rawResponseText,
    };
  }

  const validated = validateReviewOutput(parsed, input.rules);
  if (!validated.ok) {
    return {
      ok: false,
      stage: "zod_validation",
      message: validated.message,
      stopReason,
      latencyMs,
      modelId: response.model,
      rawResponseText,
    };
  }

  return {
    ok: true,
    review: validated.value,
    modelId: response.model,
    stopReason,
    latencyMs,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    estimatedCostYen: estimateCostYen(
      response.model,
      response.usage.input_tokens,
      response.usage.output_tokens,
    ),
    rawResponseText,
  };
}
