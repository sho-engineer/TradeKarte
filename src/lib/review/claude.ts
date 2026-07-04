import Anthropic from "@anthropic-ai/sdk";
import { isVerdict, type Review } from "./types";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `あなたは経験豊富な裁量FXトレーダーのレビュアーです。ユーザーが既に執行したトレード(チャート画像と状況メモ)を見て、その「意思決定の質」だけを批評してください。

厳守事項:
- 今後の売買シグナル・エントリー/損切り/利確の推奨・将来の価格予測は一切出さない。過去の振り返り支援のみ。
- 判定は損益(勝ち負け)と独立させる。エントリー時点で見えていた情報のみで判断の質を評価する。結果論・後知恵は禁止。「勝ったのに衝動」「負けたのにエッジ」は普通にありうる。
- 思考の順序: ①エントリー/エグジットの根拠を評価する → ②その根拠が本当に十分か、自分で疑って検証する(バイアス・衝動の可能性を探す) → ③以上を踏まえて最終判定する。
- 出力は指定されたJSONのみ。前置き・コードフェンス・説明文は付けない。`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    verdict: {
      type: "string",
      enum: ["エッジ", "衝動", "混在"],
      description: "意思決定の質の最終判定",
    },
    coach: {
      type: "string",
      description:
        "所見(コーチ): エントリー/エグジットの根拠の妥当性とルール整合性。2〜3文。",
    },
    critic: {
      type: "string",
      description:
        "指摘(批判者): 穴・バイアス・見落とし。エッジ主導か衝動(FOMO/ポジポジ病/リベンジ)主導かの理由。負けの場合は「判断の負け」か「確率の負け」かを明確に区別する。2〜3文。",
    },
    next_action: {
      type: "string",
      description:
        "次の一手: 次回に意識する振り返り上の改善を1つだけ。1文。未来の売買指示にしない。",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description:
        "最大4個。通貨ペア/時間帯/セットアップ/感情など、後からパターン検出できる短いタグ。",
    },
  },
  required: ["verdict", "coach", "critic", "next_action", "tags"],
  additionalProperties: false,
} as const;

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";

export interface ReviewInput {
  imageMediaType: ImageMediaType;
  imageBase64: string;
  memo: string;
  pair?: string;
  direction?: string;
  result?: string;
}

function buildUserText(input: ReviewInput): string {
  const lines = [
    "以下のトレードをレビューしてください。",
    "",
    `状況メモ: ${input.memo.trim() || "(記載なし)"}`,
  ];
  if (input.pair) lines.push(`通貨ペア: ${input.pair}`);
  if (input.direction) lines.push(`方向: ${input.direction}`);
  if (input.result)
    lines.push(
      `結果: ${input.result} ※判定の根拠に使わないこと(損益と判定は独立)`,
    );
  lines.push(
    "",
    "手順どおり、①根拠の評価 → ②自己反証(バイアス・衝動の可能性) → ③最終判定 の順に考えたうえで、結論のみをJSONで出力してください。",
  );
  return lines.join("\n");
}

export async function generateReview(input: ReviewInput): Promise<Review> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ReviewError(
      "AI APIキーが未設定です。環境変数 ANTHROPIC_API_KEY を設定してください。",
      500,
    );
  }
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: OUTPUT_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: input.imageMediaType,
              data: input.imageBase64,
            },
          },
          { type: "text", text: buildUserText(input) },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new ReviewError(
      "このリクエストはレビューできませんでした。画像とメモの内容をご確認ください。",
      422,
    );
  }

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) {
    throw new ReviewError("AIレビューの生成に失敗しました。", 502);
  }
  return parseReview(text);
}

export function parseReview(text: string): Review {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new ReviewError("AIレビューの解析に失敗しました。", 502);
  }
  const obj = raw as Record<string, unknown>;
  if (
    !isVerdict(obj.verdict) ||
    typeof obj.coach !== "string" ||
    typeof obj.critic !== "string" ||
    typeof obj.next_action !== "string" ||
    !Array.isArray(obj.tags)
  ) {
    throw new ReviewError("AIレビューの形式が不正です。", 502);
  }
  return {
    verdict: obj.verdict,
    coach: obj.coach,
    critic: obj.critic,
    next_action: obj.next_action,
    tags: obj.tags
      .filter((t): t is string => typeof t === "string" && t.trim() !== "")
      .map((t) => t.trim())
      .slice(0, 4),
  };
}

export class ReviewError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ReviewError";
  }
}
