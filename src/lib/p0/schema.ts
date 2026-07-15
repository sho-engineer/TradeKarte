import { z } from "zod";
import {
  ADHERENCES,
  ASSESSMENTS,
  CONFIDENCES,
  OBSERVATIONS,
  RULE_TYPES,
  type NormalizedRule,
  type ReviewOutput,
} from "./types";

// 機能設計書 v3.3 §8 のJSON Schema。Structured Outputs へ渡す。
// 配列上限(最大4件等)は Structured Outputs が数量制約を保証しないため、
// 送信スキーマには含めず Zod 側で拒否する(§8.1、AI-OUT-004)。
export const reviewJsonSchema = {
  type: "object",
  properties: {
    assessment: { type: "string", enum: [...ASSESSMENTS] },
    confirmed_facts: {
      type: "array",
      items: { type: "string" },
      description:
        "最大4件。画像またはユーザー文章のどちらが出所かを文中に明記",
    },
    rule_check: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rule_id: { type: "string", description: "入力されたID" },
          rule_type: { type: "string", enum: [...RULE_TYPES] },
          rule_text: {
            type: "string",
            description: "入力された条件文をそのまま返す",
          },
          observation: { type: "string", enum: [...OBSERVATIONS] },
          adherence: { type: "string", enum: [...ADHERENCES] },
          reason: {
            type: "string",
            description: "判断理由。画像またはユーザー文章の出所を明記",
          },
        },
        required: [
          "rule_id",
          "rule_type",
          "rule_text",
          "observation",
          "adherence",
          "reason",
        ],
        additionalProperties: false,
      },
    },
    behavior_signals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          signal: { type: "string", description: "観察可能な行動兆候" },
          confidence: { type: "string", enum: [...CONFIDENCES] },
          reason: {
            type: "string",
            description: "具体的根拠。画像またはユーザー文章の出所を明記",
          },
        },
        required: ["signal", "confidence", "reason"],
        additionalProperties: false,
      },
    },
    missing_information: {
      type: "array",
      items: { type: "string" },
      description: "最大4件",
    },
    reflection_question: { type: "string", description: "疑問文を1つ" },
    confidence: { type: "string", enum: [...CONFIDENCES] },
  },
  required: [
    "assessment",
    "confirmed_facts",
    "rule_check",
    "behavior_signals",
    "missing_information",
    "reflection_question",
    "confidence",
  ],
  additionalProperties: false,
} as const;

// Zod による再検証(§8.1)。未知enum・追加プロパティ・配列上限超過を拒否。
export const reviewZodSchema = z.strictObject({
  assessment: z.enum(ASSESSMENTS),
  confirmed_facts: z.array(z.string().min(1)).max(4),
  rule_check: z
    .array(
      z.strictObject({
        rule_id: z.string().min(1),
        rule_type: z.enum(RULE_TYPES),
        rule_text: z.string().min(1),
        observation: z.enum(OBSERVATIONS),
        adherence: z.enum(ADHERENCES),
        reason: z.string().min(1),
      }),
    )
    .max(6),
  behavior_signals: z
    .array(
      z.strictObject({
        signal: z.string().min(1),
        confidence: z.enum(CONFIDENCES),
        reason: z.string().min(1),
      }),
    )
    .max(2),
  missing_information: z.array(z.string().min(1)).max(4),
  reflection_question: z.string().min(1),
  confidence: z.enum(CONFIDENCES),
});

export type ReviewValidationResult =
  | { ok: true; value: ReviewOutput }
  | { ok: false; message: string };

/** 行動指示の禁止語(簡易検査、AI-OUT-015) */
const DIRECTIVE_PATTERNS = [
  /てください/,
  /て下さい/,
  /しなさい/,
  /すべきです/,
  /するべきです/,
  /しましょう/,
];

function isInterrogative(text: string): boolean {
  const t = text.trim();
  return t.endsWith("？") || t.endsWith("?");
}

/**
 * Structured Outputs 通過後のアプリ側検証(§8.1)。
 * Zod → rule mapping(rule_id集合完全一致・重複なし・text/type一致・評価方向)
 * → reflection_question 検査。失敗時はカルテを作らない。
 */
export function validateReviewOutput(
  parsed: unknown,
  inputRules: NormalizedRule[],
): ReviewValidationResult {
  const zodResult = reviewZodSchema.safeParse(parsed);
  if (!zodResult.success) {
    return { ok: false, message: `zod: ${zodResult.error.issues[0]?.message ?? "invalid"}` };
  }
  const value = zodResult.data;

  // rule_check 件数が入力条件数と同じ
  if (value.rule_check.length !== inputRules.length) {
    return {
      ok: false,
      message: `rule_check件数不一致: expected=${inputRules.length} actual=${value.rule_check.length}`,
    };
  }

  // rule_id 重複なし
  const seen = new Set<string>();
  for (const rc of value.rule_check) {
    if (seen.has(rc.rule_id)) {
      return { ok: false, message: `rule_id重複: ${rc.rule_id}` };
    }
    seen.add(rc.rule_id);
  }

  // rule_id 集合が入力と完全一致 + rule_type / rule_text が入力値と完全一致
  const inputById = new Map(inputRules.map((r) => [r.rule_id, r]));
  for (const rc of value.rule_check) {
    const input = inputById.get(rc.rule_id);
    if (!input) {
      return { ok: false, message: `入力にないrule_id: ${rc.rule_id}` };
    }
    if (rc.rule_type !== input.rule_type) {
      return { ok: false, message: `rule_type改変: ${rc.rule_id}` };
    }
    if (rc.rule_text !== input.rule_text) {
      return { ok: false, message: `rule_text改変: ${rc.rule_id}` };
    }
  }
  for (const r of inputRules) {
    if (!seen.has(r.rule_id)) {
      return { ok: false, message: `rule_id不足: ${r.rule_id}` };
    }
  }

  // 評価方向(required / avoid反転 / invalidation、unknown対応)
  for (const rc of value.rule_check) {
    const { observation, adherence, rule_type, rule_id } = rc;
    if (observation === "unknown") {
      if (adherence !== "unknown") {
        return {
          ok: false,
          message: `observation=unknownはadherence=unknownでなければならない: ${rule_id}`,
        };
      }
      continue;
    }
    const expected =
      rule_type === "required"
        ? observation === "met"
          ? "compliant"
          : "violated"
        : // avoid / invalidation: 発生(met)は violated、非発生(not_met)は compliant
          observation === "met"
          ? "violated"
          : "compliant";
    if (adherence !== expected) {
      return {
        ok: false,
        message: `評価方向不正(${rule_type}): ${rule_id} observation=${observation} adherence=${adherence}`,
      };
    }
  }

  // reflection_question: 疑問文であること + 行動指示の禁止語
  if (!isInterrogative(value.reflection_question)) {
    return { ok: false, message: "reflection_questionが疑問文でない" };
  }
  for (const p of DIRECTIVE_PATTERNS) {
    if (p.test(value.reflection_question)) {
      return { ok: false, message: "reflection_questionに行動指示が含まれる" };
    }
  }

  return { ok: true, value };
}
