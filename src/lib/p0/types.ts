// Phase 0A 内部enum(機能設計書 v3.3 §0/§4/§13)。
// DB・API・Zod・TypeScript は英語キー、UIのみ日本語表示へ変換する。

export const ASSESSMENTS = [
  "ruleok",
  "insufficient",
  "violation",
  "impulse",
  "mix",
  "unknown",
] as const;
export type AssessmentKey = (typeof ASSESSMENTS)[number];

export const ASSESSMENT_LABELS: Record<AssessmentKey, string> = {
  ruleok: "ルール適合",
  insufficient: "根拠不足",
  violation: "ルール逸脱",
  impulse: "衝動兆候",
  mix: "混在",
  unknown: "判定不能",
};

export const RULE_TYPES = ["required", "avoid", "invalidation"] as const;
export type RuleType = (typeof RULE_TYPES)[number];

export const OBSERVATIONS = ["met", "not_met", "unknown"] as const;
export type Observation = (typeof OBSERVATIONS)[number];

export const ADHERENCES = ["compliant", "violated", "unknown"] as const;
export type Adherence = (typeof ADHERENCES)[number];

export const CONFIDENCES = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const EMOTIONS = [
  "calm",
  "rushed",
  "revenge",
  "excited",
  "anxious",
] as const;
export type EmotionKey = (typeof EMOTIONS)[number];

export const EMOTION_LABELS: Record<EmotionKey, string> = {
  calm: "冷静",
  rushed: "焦り",
  revenge: "取り返したい",
  excited: "興奮",
  anxious: "不安",
};

export const MEMORY_SOURCES = ["recorded_at_time", "from_memory"] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];

export const DIRECTIONS = ["long", "short"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const BLIND_INTEGRITIES = ["clean", "warning_overridden"] as const;
export type BlindIntegrity = (typeof BLIND_INTEGRITIES)[number];

export const FAILURE_STAGES = [
  "request_validation",
  "anthropic_http",
  "network",
  "refusal",
  "max_tokens",
  "structured_output",
  "zod_validation",
  "database",
  "unknown",
] as const;
export type FailureStage = (typeof FAILURE_STAGES)[number];

export const FEEDBACK_RATINGS = ["helpful", "partial", "not_helpful"] as const;
export type FeedbackRating = (typeof FEEDBACK_RATINGS)[number];

export const INCORRECT_AREAS = [
  "chart_reading",
  "rule_parsing",
  "rule_alignment",
  "behavior_signal",
  "assessment",
  "reflection_question",
  "other",
] as const;
export type IncorrectArea = (typeof INCORRECT_AREAS)[number];

/** AIへ渡す正規化済みプレイブック条件(§3.3) */
export interface NormalizedRule {
  rule_id: string;
  rule_type: RuleType;
  rule_text: string;
}

/** プレイブックの保存形式(§3.3) */
export interface PlaybookRules {
  must_rules: { rule_id: string; text: string }[];
  avoid_rules: { rule_id: string; text: string }[];
  stop_rule: { rule_id: string; text: string } | null;
}

/** AIレビューの検証済み出力(§8) */
export interface ReviewOutput {
  assessment: AssessmentKey;
  confirmed_facts: string[];
  rule_check: {
    rule_id: string;
    rule_type: RuleType;
    rule_text: string;
    observation: Observation;
    adherence: Adherence;
    reason: string;
  }[];
  behavior_signals: {
    signal: string;
    confidence: Confidence;
    reason: string;
  }[];
  missing_information: string[];
  reflection_question: string;
  confidence: Confidence;
}
