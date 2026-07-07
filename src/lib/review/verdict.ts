import type { Verdict } from "./types";

export interface VerdictMeta {
  /** 判定印の英字ラベル */
  en: string;
  /** カルテ見出しに使う一文 */
  headline: string;
  /** 判定色(CSS変数) */
  color: string;
  /** 弱いボーダー色(CSS変数) */
  borderColor: string;
}

export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  エッジ: {
    en: "EDGE",
    headline: "根拠主導の判断。優位性に基づいた入り。",
    color: "var(--tk-edge)",
    borderColor: "var(--tk-edge-border)",
  },
  衝動: {
    en: "IMPULSE",
    headline: "感情主導の入り。値動きへの反応が根拠に先行。",
    color: "var(--tk-impulse)",
    borderColor: "var(--tk-impulse-border)",
  },
  混在: {
    en: "MIXED",
    headline: "妥当な根拠と感情的要素が混在した判断。",
    color: "var(--tk-mixed)",
    borderColor: "var(--tk-mixed-border)",
  },
};

const FALLBACK: VerdictMeta = {
  en: "",
  headline: "",
  color: "var(--tk-text-weak)",
  borderColor: "var(--tk-rule)",
};

export function verdictMeta(verdict: string): VerdictMeta {
  return VERDICT_META[verdict as Verdict] ?? FALLBACK;
}
