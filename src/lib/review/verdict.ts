import type { Verdict } from "./types";

export interface VerdictMeta {
  /** 意味の一言(スタンプ横に表示) */
  gloss: string;
  /** 補足説明(凡例・詳細用) */
  description: string;
  /** チップ/スタンプの配色クラス */
  chip: string;
  /** テキスト色クラス(見出し等) */
  text: string;
  /** 左カラーレール等のボーダー色クラス */
  border: string;
  /** 淡い背景色クラス */
  soft: string;
}

export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  エッジ: {
    gloss: "根拠主導",
    description: "優位性のある根拠に基づいた判断。",
    chip: "border-edge/50 bg-edge/15 text-edge",
    text: "text-edge",
    border: "border-edge",
    soft: "bg-edge/10",
  },
  衝動: {
    gloss: "感情主導",
    description: "FOMO・ポジポジ病・リベンジなど感情が主導した判断。",
    chip: "border-impulse/50 bg-impulse/15 text-impulse",
    text: "text-impulse",
    border: "border-impulse",
    soft: "bg-impulse/10",
  },
  混在: {
    gloss: "根拠と衝動が混在",
    description: "妥当な根拠と感情的要素が入り混じった判断。",
    chip: "border-mixed/50 bg-mixed/15 text-mixed",
    text: "text-mixed",
    border: "border-mixed",
    soft: "bg-mixed/10",
  },
};

const FALLBACK: VerdictMeta = {
  gloss: "",
  description: "",
  chip: "border-line bg-panel-2 text-muted",
  text: "text-muted",
  border: "border-line",
  soft: "bg-panel-2",
};

export function verdictMeta(verdict: string): VerdictMeta {
  return VERDICT_META[verdict as Verdict] ?? FALLBACK;
}
